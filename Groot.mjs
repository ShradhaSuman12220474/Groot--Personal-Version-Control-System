#!/usr/bin/env node
import path, { join } from 'path';
import fs from 'fs/promises'
import crypto from 'crypto'
import { diffLines } from 'diff';
import chalk from 'chalk';
import { Command } from 'commander';
import { argv } from 'process';


const program = new Command();
class Groot{

    constructor(repoPath='.'){
        this.repoPath = path.join(repoPath,'.groot');//  ./.groot
        this.objectsPath = path.join(this.repoPath,'objects');//.groot/objects
        this.headPath = path.join(this.repoPath,'HEAD');//.groot/HEAD
        this.indexPath = path.join(this.repoPath,'index')//.groot/index
        this.init();
    }

    async init(){
        await fs.mkdir(this.objectsPath,{recursive: true});
        try{
            // console.log("from the try block")
            await fs.writeFile(this.headPath ,'',{flag:'wx'});// wx: means write exculisive that means if the file doesnt exist then only it will create it and if the file already existed then it will fail
            await fs.writeFile(this.indexPath, JSON.stringify([]), {flag:'wx'});
        } catch(error){
            console.log("Already initilised the .groot folder");
        }
    }

    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex');// this line is going to create an object for sha1 hash and using this object we can call an update method and pass our content and it will creat a hash out of it if we also pass the encoding the it is going to return us the string and then converted that string to the hexadecimal value;
    }
    
    // now we are going to create a .add method
    async add(fileToBeAdded){
        const fileData = await fs.readFile(fileToBeAdded, {encoding: 'utf-8'});//read the file data
        const fileHash = this.hashObject(fileData);// created a hash out of that data
        console.log(fileHash);

        const newFileHashedObjectPath = path.join(this.objectsPath,fileHash);//.groot/objects/'hashcode'
        await fs.writeFile(newFileHashedObjectPath,fileData);// makes the file in the newFileHasedObjectsPath and the content of the file is the fileData

        // TODO: one step is missing adding the file to the staging area i.e adding it to the index file

        await this.updateStagingArea(fileToBeAdded,fileHash);
        console.log(`Added the ${fileToBeAdded}`);
    }
    
    async updateStagingArea(filePath, fileHash){
        const indexContent = JSON.parse(await fs.readFile(this.indexPath, {encoding: 'utf-8'}));

        indexContent.push({path:filePath,hash:fileHash });

        await fs.writeFile(this.indexPath,JSON.stringify(indexContent));
    }

    async commit(message){
        const indexContent = JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));

        const parentCommit = await this.getCurrentHead();// current head is present in the head file that we have created

        const commitData = {
            timeStamp : new Date().toISOString(),
            message,
            files:indexContent,
            parent : parentCommit
        };

        // now we are creating the hash of the commit also
        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath,commitHash);
        await fs.writeFile(commitPath , JSON.stringify(commitData));
        await fs.writeFile(this.headPath, commitHash);
        // now everything has pushed to the repo so we have to clean the staging area i.e index file
        await fs.writeFile(this.indexPath,JSON.stringify([])); 
        console.log(`commit succesfully created ${commitHash}`);    
    }

    async getCurrentHead(){
        try{
            return await fs.readFile(this.headPath, {encoding:'utf-8'});

        }
        catch(error){
            return null;
        }
    }

    async log(){
        let currentCommitHash = await this.getCurrentHead();
        while(currentCommitHash){
            const commitData = JSON.parse(await this.getData(currentCommitHash));
            console.log("--------------------------------------")
            console.log(`commit: ${currentCommitHash}\n Date:${commitData.timeStamp} \n commit message: ${commitData.message} `);

            currentCommitHash = commitData.parent;
        }

    }

    async getData(hash){
        const dataPath = path.join(this.objectsPath,hash);
        try{
            return await fs.readFile(dataPath, {encoding:'utf-8'});
        }catch(error){
            console.log("Failed To read the data",error);
            return null;
        }
    }

    async showCommitDiff(commitHash){
        const commitData = JSON.parse(await this.getData(commitHash));
        // console.log(commitData);
        if(!commitData){
            console.log("commit not found");
            return;
        }

        console.log("changes in the last commit are: ")

        for(const file of commitData.files){
            // printed the content of the current file
            console.log(`File Name: ${file.path}`);
            const fileContent = await this.getData(file.hash);
            console.log(fileContent);
            // now we are moving to the previous commit file and reading the data in there
            if(commitData.parent){
                // get the parent commit data
                
                const parentCommitData = JSON.parse(await this.getData(commitData.parent));
                const parentFileContent = await this.getParentFileContent(parentCommitData,file.path);

                if(parentFileContent  !== undefined){
                    console.log("\n diff: ");
                    const diff = diffLines(parentFileContent,fileContent,{newlineIsToken: true});// we are in here comparing the parent file content and the current File content
                    //currentCommit{f1,f2,f3} and parentCommit{f1,f2} so we are taking f1 and then searching it in parent commit if we get then we fetch the data of f1 in parent commit then we are going to compare the both the data.
                    // console.log(diff);
                    // the diff returns the array which contains the comparision of each lines in the file
                    diff.forEach(part =>{
                        if(part.added){// if something is added
                            process.stdout.write(chalk.green("[+]" + part.value));
                        }else if(part.removed){// if something is removed   
                            process.stdout.write(chalk.red("[-]" +part.value));
                        }else{// if both the lines are same
                            process.stdout.write(chalk.grey(part.value));
                        }

                    });
                    console.log();
                }
                else{// current file in the parent doesn't exits i.e new file is created in the current commit
                    console.log("New file created in this commit");     
                }
            }else{
                console.log("This is the first commit");
            }
        }
    }

    async getParentFileContent(parentCommitData, currentFilePath){
        // this parent file in here is the array which contains the Filepath and its hash
        const parentFile = parentCommitData.files.find(file => file.path === currentFilePath);
        if(parentFile){
            // get the file content from the parent commit data return the file content
            return await this.getData(parentFile.hash);
        }
    }
}

// (async ()=>{
//     const groot = new Groot();
//     // await groot.add('sample.txt');
//     // await groot.add('sample2.txt');
//     // await groot.commit('Added the second file commit');

//     // await groot.log();
//     await groot.showCommitDiff('e136e147d8d2131e928e1eb8d4df632c6482953e');
// })();


program.command('init').action(async()=>{
    const groot = new Groot();

});

program.command('add <file>').action(async(file)=>{
    const groot = new Groot();
    groot.add(file);
});

program.command('commit <message>').action(async(message)=>{
    const groot = new Groot();
    groot.commit(message);
});

program.command('log').action(async()=>{
    const groot = new Groot();
    groot.log();
});

program.command('show <commitHash>').action(async(commitHash)=>{
    const groot = new Groot();
    groot.showCommitDiff(commitHash);
});

// form where it is going to read it
program.parse(process.argv);// argv gives all the command line arguments that is required to run this file.