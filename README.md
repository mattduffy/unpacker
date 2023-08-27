# Unpack Files From a Compressed Archive

This package for Node.js provides an object-oriented interface for working with archive files.  Archive in this case refers to either **gzip** or **zip** compressed files and **tar** files.  This package is compatible with POSIX systems; it will not work on a Windows machine as-is. This package will not run in a browser.

## Using Unpacker
The goal of this package is to simplify the process of unpacking several different formats of file archives, most likely uploaded to a website, for further processing or integration.  This package abstracts away the need to know the mime type of the archive, and the commands necessary to unpack and move the archive contents to the desired target destination.  The Unpacker class instantiates with a simple interface and is able to determine the location and version of ```tar```, ```gzip``` and ```zip``` binaries.

```bash
npm install --save @mattduffy/unpacker
```

```javascript
import { Unpacker } from '@mattduffy/unpacker'
let unpacker = new Unpacker()
```

The Unpacker constructor does a litle bit of instance setup, but the important stuff currently happens the first time the ```setPath()``` method is called.  This is when checks for the locally installed versions of ```tar```, ```gzip``` and ```zip``` are performed.  Their respective file system paths and version numbers are stored as instance properties.  This happens here rather than the constructor method because it happens asynchronously.  This is an **Async/Await** method.

```javascript
let unpacker = new Unpacker()
// a relative path to archive file
await unpacker.setPath('relative/path/to/archive.zip')

// an absolute path to archive file
await unpacker.setPath('/absolute/path/to/archive.tar.gz')
```

The ```setPath()``` method requires a single parameter specifying the location of an archive file.  The method will accept either a relative path or an absolute path to the archive.  The relative path is resolved from the current working directory of the module that included the Unpacker package.  If the path provided to the method does not succesfully resolve to a file, with a mime type of ```application/x-tar```, ```application-zip``` or ```application/gzip```, it will throw an error.

After the ```setPath()``` method has been called, the mime type of the archive is available with the ```getMimetype()``` method.

```javascript
const unpacker = new Unpacker()
await unpacker.setPath('uploads/photos.tar.gz')
const mime = unpacker.getMimetype()
console.log(mime)
// 'application/gzip'
```

If you would like to see the path to binaries used for unpacking, and their respective version numbers, the ```checkCommands()``` method will provide that.  This is an **Async/Await** method.

```javascript
const unpacker = new Unpacker()
const binaries = await unpacker.checkCommands()
console.log(binaries)
// {
//   tar: { path: '/usr/bin/tar', version: '1.30' },
//   gzip: { path: '/usr/bin/gzip', version: '1.10' },
//   unzip: { path: '/usr/bin/unzip', version: '6.00' }
// }
```

After the the path to an archive file has been set, the ```unpack()``` method will complete the task.  The method requires a single parameter specifying the target location for the unpacked files.  The method will accept either a relative path or an absolute path.  The relative path is resolved from the current working directory of the module that included the Unpacker package.  This is an **Async/Await** method.

```javascript
const unpacker = new Unpacker()
await unpacker.setPath('uploads/myPhotos.tar.gz')
const result = await unpacker.unpack('static/albums')
console.log(result)
// {
//   stdout: '',
//   stderr: '',
//   unpacked: true,
//   cwd: '/www/app/uploads/myPhotos',
//   destination: '/www/app/static/albums/'
// }
```

The ```unpack()``` method also accepts two additional optional parameters.  The first optional parameter is for controlling how the underlying ```mv``` command works.  The default behavior is to tell the ```mv``` command to force a move, and automatically create a backup of an existing directory.  If you don't mind overwritting an existing directory, you can set the property ```backup: ''```.  The second optional parameter lets you change the destination directory name after it has been moved.
```javascript
// default mv command options { force: true, backup: 'numbered'}
const unpacker = new Unpacker()
await unpacker.setPath('uploads/myPhotos.tar.gz')
const result = await unpacker.unpack('static/albums', {force: true, backup: ''}, {rename: true, newName: 'The_Latest_Photos'})
console.log(result)
// {
//   stdout: '',
//   stderr: '',
//   unpacked: true,
//   cwd: '/www/app/uploads/myPhotos',
//   destination: '/www/app/static/albums/'
// }
```

Unpacker provides a way to peek inside the archive file without having to extract the contents to the file system using the ```list()``` method.  After the ```setPath()``` method has been called, setting the location of the archive file, this method will return an object containing an array of file names and the native command of the archive binary used.  This is an **Async/Await** method.
```javascript
const unpacker = new Unpacker()
await unpacker.setPath('uploads/files.tar.gz')
const { list } = await unpacker.list()
console.log(list)
// {
//  cmd: 'tar --exclude=__MACOSX --exclude=._* --exclude=.svn --exclude=.git* -tf /www/site/uploads/files.tar',
//  list: [
//    'files/',
//    'files/file-2.txt',
//    'files/file-1.txt',
//    'files/file-3.txt'
//  ]
// }
```

If there are problems with the unpacking process, the method will throw an error.  Upon successful unpacking and moving files to the target destination, the Unpacker instance will make an effort to clean up the weird artifacts that may have been created (like "dot" hidden resource folders ```.myPhotos``` or \__MACOSX ).

On **POSIX** platforms that include a version of the ```mv``` command that supports the ```--backup=[option]``` argument, a backup is automatically created if there is already a file or directory at the target destination with the same name.  For example, if ```/www/app/static/albums/myPhotos/``` already exists when ```myPhotos.tar.gz``` is unpacked with ```unpacker.unpack('/www/app/static/albums')``` then the original directory will be renamed ```/www/app/static/albums/myPhotos.~n~``` where **n** is an auto-incrementing integer, starting at 1.
