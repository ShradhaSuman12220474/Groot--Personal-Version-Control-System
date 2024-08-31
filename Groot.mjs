import path from 'path';
import fs from 'fs/promises'
import crypto from 'crypto'

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
}

(async ()=>{
    const groot = new Groot();
    await groot.add('sample.txt');
    await groot.commit('initial commit');
})();
