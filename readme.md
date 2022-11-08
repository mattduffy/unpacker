# Unpack Files From a Compressed Archive

This package for Node.js provides an object-oriented interface for working with archive files.  Archive in this case refers to either **gzip** compressed files, **tar** files, and of course, my favorite type,  **tarball** compressed archives.  Contrary to the name of this module, Unpacker can also be use to create archives, compressed or not, 

## Installing Unpacker


```bash
npm install --save @mattduffy/unpacker
```

```javascript
import { Unpacker } from '@mattduffy/unpacker'
let unpacker = new Unpacker()
```


