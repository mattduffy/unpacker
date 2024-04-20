/**
 * @module @mattduffy/unpacker
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Unpacker class definition file.
 */
import nodePath from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import Debug from 'debug'

const __filename = fileURLToPath(import.meta.url)
const __dirname = nodePath.dirname(__filename)
const cmd = promisify(exec)
const _log = Debug('unpacker:class:LOG')
const _error = Debug('unpacker:class:ERROR')
const RAR = 'application/x-rar'
const TAR = 'application/x-tar'
const ZIP = 'application/zip'
const GZIP = 'application/gzip'
const OCTET = 'application/octet-stream'
const DIRECTORY = 'inode/directory'

/**
 * A utility class to unpack (unzip, untar, etc.) uploaded archive files.
 * @summary A utility class to upack (unzip, untar, etc.) uploaded archive files.
 * @class Unpacker
 * @extends EventEmitter
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
export class Unpacker extends EventEmitter {
  /**
   * Create an instance of Unpacker.
   * @param { string } pathToArchiveFile - String value of a file system path to an uploaded archive to unpack.
   */
  constructor(pathToArchiveFile) {
    super()
    this._path = pathToArchiveFile ?? null
    this._file = null
    this._fileBasename = null
    this._fileExt = null
    this._mimetype = null
    this._fileList = null
    this._isTarFile = false
    this._isRarFile = false
    this._isGzipFile = false
    this._isZipFile = false
    this._isCompressed = false
    this._tar = null
    this._unrar = null
    this._gzip = null
    this._unzip = null
    this._cwd = process.cwd()
    this.__dirname = __dirname
    this._platform = process.platform
  }

  /**
   * Return the string value of the file system path to the archive.
   * @summary Return the string value of the file system path to the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { string } The file system path to the archive.
   */
  getPath() {
    return this._path
  }

  /**
   * Set the value of path to the file system location of the archive.
   * @summary Set the value of the path to the file system location of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } filePath - String value of a file system path to the archive.
   * @throws { Error } Throws an error if the file path is invalid.
   * @return { undefind } Returns undefined if no errors encountered.
   */
  async setPath(filePath) {
    const log = _log.extend('setPath')
    const error = _error.extend('setPath')
    if (!filePath) {
      throw new Error('Missing required path argument.')
    }
    try {
      if (this._tar === null) {
        await this.whichTar()
      }
    } catch (e) {
      throw new Error('Failed to find tar.')
    }
    try {
      if (this._unrar === null) {
        await this.whichRar()
      }
    } catch (e) {
      throw new Error('Failed to find tar.')
    }
    try {
      if (this._gzip === null) {
        await this.whichGzip()
      }
    } catch (e) {
      error(e)
      throw new Error('Failed to find gzip.')
    }
    try {
      if (this._unzip === null) {
        await this.whichUnzip()
      }
    } catch (e) {
      error(e)
      throw new Error('Failed to find unzip.')
    }
    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw new Error(`Not a file: ${filePath}`)
      } else {
        this._path = nodePath.resolve(filePath)
        await this.setMimetype(this._path)
        this._file = nodePath.parse(this._path)
      }
    } catch (e) {
      error(e)
      throw new Error(`Not a valid file path: ${filePath}`)
    }
    try {
      this.setExtension(filePath)
    } catch (e) {
      error(e)
      throw new Error(`File extension problem: ${filePath}`, { cause: e })
    }
    try {
      this.setFileBasename(filePath)
    } catch (e) {
      error(e)
      throw new Error(`File basename problem: ${filePath}`)
    }
    log(`setPath: ${this._path}`)
    // return undefined
    return this
  }

  /**
   * Return the string value of mime type of the archive.
   * @summary Return the string value of the mime type of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { string } The archive file mime type.
   */
  getMimetype() {
    return this._mimetype
  }

  /**
   * Record the mime type of the archive file.
   * @summary Record the mime type of the archive file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } file - A file sytem path to the file.
   * @throws { Error } Throws an error if the file path is invalid.
   * @return { undefined } Returns undefined if no error is encountered.
   */
  async setMimetype(file) {
    const log = _log.extend('setMimetype')
    const error = _error.extend('setMimetype')
    try {
      const result = await cmd(`file --mime-type --brief '${file}'`)
      const mime = result.stdout.trim()
      log(result)
      log(`${file}: ${mime}`)
      switch (result.stdout.trim()) {
        case TAR:
          this._mimetype = TAR
          break
        case RAR:
          this._mimetype = RAR
          break
        case ZIP:
          this._mimetype = ZIP
          break
        case GZIP:
          this._mimetype = GZIP
          break
        case DIRECTORY:
          this._mimetype = DIRECTORY
          break
        default:
          this._mimetype = OCTET
      }
    } catch (e) {
      error(e)
      throw new Error(`File not found: ${file}`)
    }
    return undefined
  }

  /**
   * Set the file extension of the archive file name.
   * @summary Get the file extension of the archive file name.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @param { string } file - A file system path to the file.
   * @throws { Error } Throws an errof if the file path is invalid.
   * @returns { undefined } Returns undefined if no error is encountered.
   */
  setExtension(file = this._file) {
    const log = _log.extend('setExtension')
    const error = _error.extend('setExtension')
    // const ext = /\.*(\.(t(ar)?(\.?gz)?)|(rar)?|(zip)?|(gz)?)$/.exec(file)
    const ext = /\.*(?<tar>\.tar$)|(\.(?<tgz>t(?:ar)?(\.?gz)?)|(?<rar>\.rar)|(?<zip>\.zip)?|(?<gz>\.gz)?)$/.exec(file)
    if (ext === null) {
      error(`${file} does not look like an compressed archive file.`)
      throw new Error(`File ${file} does not look like a (compressed) archive file.`)
    }
    // log(`file extension: ${ext[0]}`)
    log('file extension matches: ', ext?.groups)
    // if (['.tar.gz', '.tgz'].includes(ext[0])) {
    if (ext.groups.tgz && !ext.groups.gz) {
      this._isCompressed = true
      this._isTarFile = true
      // hack to work around mimetype reported as application/gzip when compressed tar
      this._mimetype = TAR
    // } else if (/\.?tar$/.test(ext[0])) {
    } else if (ext.groups.tar) {
      this._isTarFile = true
      this._isCompressed = false
    // } else if (this._mimetype === ZIP) {
    } else if (this._mimetype === ZIP && ext.groups.zip) {
      this._isCompressed = true
      this._isZipFile = true
    // } else if (this._mimetype === GZIP) {
    } else if (this._mimetype === GZIP && ext.groups.gz && !ext.groups.tar && !ext.groups.tgz) {
      this._isCompressed = true
      this._isGzipFile = true
    // } else if (this._mimetype === RAR) {
    } else if (this._mimetype === RAR && ext.groups.rar) {
      this._isCompressed = false
      this._isRarFile = true
    } else {
      throw new Error(`File ${file} does not look like a (compressed) archive file.`)
    }
    [this._fileExt] = ext
    log(`file extension set to: ${this._fileExt}`)
  }

  /**
   * Get the file extension of the archive file name.
   * @summary Get the file extension of the archive file name.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * return { string } The archive file extension.
   */
  getExtension() {
    return this._fileExt
  }

  /**
   * Set the file base name (without the file extension).
   * @summary Set the file base name (without the file extension).
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { undefined }
   */
  setFileBasename() {
    /* eslint-disable-next-line no-useless-escape */
    // const pattern = `^.*${}\/(.+)$/`;
    const pattern = `^(.*)${this._fileExt}$`;
    [, this._fileBasename] = this._file.base.match(pattern)
  }

  /**
   * Get the file base name (without the file extension).
   * @summary Get the file base name (without the file extension).
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { string } The base name of the file (without the file extension).
   */
  getFileBasename() {
    return this._fileBasename
  }

  /**
   * Find the location of the tar executable.
   * @summary Find the location of the tar executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for tar fails.
   * @return { undefined } Returns undefined if no error is encountered.
   */
  async whichTar() {
    const log = _log.extend('whichTar')
    const error = _error.extend('whichTar')
    const tar = { path: null, version: null }
    try {
      let path = await cmd('which tar')
      path = path.stdout.trim()
      if (!/tar/.test(path)) {
        this._tar = false
        return
      }
      tar.path = path
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${tar.path} --version | awk '/([0-9]\.[0-9]+)$/ { print $NF}'`)
      tar.version = version.stdout.trim()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    this._tar = tar
    log(`which tar -> ${this._tar.path}`)
  }

  /**
   * Find the location of the unrar executable.
   * @summary Find the location of the unrar executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for unrar fails.
   * @return { undefined } Returns undefined if no error is encountered.
   */
  async whichRar() {
    const log = _log.extend('whichRar')
    const error = _error.extend('whichRar')
    const unrar = { path: null, version: null }
    try {
      let path = await cmd('which unrar')
      path = path.stdout.trim()
      if (!/unrar/.test(path)) {
        this._unrar = false
        return
      }
      unrar.path = path
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      const version = await cmd(`${unrar.path} | awk '/([0-9]+.[0-9]+)/ { print $2 }'`)
      unrar.version = version.stdout.trim()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    this._unrar = unrar
    log(`which unrar -> ${this._unrar.path}`)
  }

  /**
   * Find the location of the gzip executable.
   * @summary Find the location of the gzip executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for gzip fails.
   * @return { undefined } Returns undefined if no error is encountered.
   */
  async whichGzip() {
    const log = _log.extend('whichGzip')
    const error = _error.extend('whichGzip')
    const gzip = { path: null, version: null }
    try {
      let path = await cmd('which gzip')
      path = path.stdout.trim()
      if (!/gzip/.test(path)) {
        this._gzip = false
        return
      }
      gzip.path = path
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${gzip.path} --version | awk '/([0-9]+\.[0-9]+)$/ { print $NF }'`)
      gzip.version = version.stdout.trim()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    this._gzip = gzip
    log(`which gzip -> ${this._gzip.path}`)
  }

  /**
   * Find the location of the unzip executable.
   * @summary Find the location of the unzip executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } Throws an error if search for unzip fails.
   * @returns { undefined } Returns undefined if no error is encountered.
   */
  async whichUnzip() {
    const log = _log.extend('whichUnzip')
    const error = _error.extend('whichUnzip')
    const unzip = { path: null, version: null }
    try {
      let path = await cmd('which unzip')
      path = path.stdout.trim()
      if (!/unzip/.test(path)) {
        this._unzip = false
        return
      }
      unzip.path = path
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${unzip.path} -v | awk '/^[Uu]n[Zz]ip ([0-9]+\.[0-9]+)/ { print $2 }'`)
      unzip.version = version.stdout.trim()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    this._unzip = unzip
    log(`which unzip -> ${this._unzip.path}`)
  }

  /**
   * Check for the presence of usable versions of tar, unrar and gzip.
   * @summary Check for the presence of usuable versions of tar, unrar and gzip.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Object } An object literal with success or error messages.
   */
  async checkCommands() {
    if (this._tar === null) {
      await this.whichTar()
    }
    if (this._unrar === null) {
      await this.whichRar()
    }
    if (this._gzip === null) {
      await this.whichGzip()
    }
    if (this._unzip === null) {
      await this.whichUnzip()
    }
    return { tar: this._tar, unrar: this._unrar, gzip: this._gzip, unzip: this._unzip }
  }

  /**
   * Unpack the archive file.  The archive file may be one of these file formats: .tar, .tar.gz, .tgz, .zip, or .gzip.
   * The contents of the archive are extracted into a folder, named after the archive, in its current directory.
   * @summary Extract the contents of the archive into a directory, with the name of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } moveTo - A file system location to move the unpacked archive to.
   * @param { Object } opts - An object literal with options for mv command.
   * @param { string } opts.backup - Tell mv command whether or not to backup existing destination path, if supported.
   * @param { Object } rename - An object literal with new name for destination directory.
   * @param { boolean } rename.rename - Should the destination directory be renamed.
   * @param { string } rename.newName - Destination renamed to this.
   * @throws { Error } Throws an error if the archive could not be unpacked.
   * @return { Object } An object literal with success or error messages.
   */
  async unpack(moveTo, opts, rename) {
    const log = _log.extend('unpack')
    const error = _error.extend('unpack')
    this._destination = moveTo
    let destination = moveTo ?? '.'
    const options = { force: true, backup: 'numbered', ...opts }
    log(`process.platform: ${this._platform}`)
    if (this._platform === 'darwin') {
      options.backup = false
    }
    if (this._tar === null && this._mimetype === TAR) {
      throw new Error(`Archive is ${this._mimetype}, but can't find tar executable.`)
    }
    if (this.gzip === null && this._mimetype === GZIP) {
      throw new Error(`Archive is ${this._mimetype}, but can't find gzip executable.`)
    }
    if (this.unrar === null && this._mimetype === RAR) {
      throw new Error(`Archive is ${this._mimetype}, but can't find unrar executable.`)
    }
    let unpack
    const tarExcludes = '--warning=no-unknown-keyword --exclude=__MACOSX* --exclude=._* --exclude=.git* --exclude=.svn*'
    const tarDirOptions = '--one-top-level --strip-components=1'
    /*
     * Because Tar is being called from the the perspective of process.cwd()
     * (not the directory containing the archive file),
     * use the --directory=<path/to/archive/file> argument to unpack the archive in-place.
     */
    this._changeToDir = `${this._path.slice(0, this._path.lastIndexOf('/'))}/`
    const tarChangeToDir = `--directory=${this._changeToDir}`
    if (this._isTarFile && !this._isCompressed) {
      // TAR .tar
      unpack = `${this._tar.path} ${tarExcludes} ${tarDirOptions} ${tarChangeToDir} -xf ${this._path}`
    // } else if (this._isTarFile && this._isGzipFile) {
    } else if (this._isTarFile && this._isCompressed) {
      // Compressed TAR .tar.gz or .tgz
      unpack = `${this._tar.path} ${tarExcludes} ${tarDirOptions} ${tarChangeToDir} -xzf ${this._path}`
    } else if (this._isGzipFile && this._isCompressed) {
      // GZIP file is probably a .gz
      unpack = `${this._gzip.path} --decompress --force --keep --suffix ${this._file.ext} ${this._path}`
    } else if (this._isZipFile) {
      // ZIP .zip
      const zipExcludes = '-x \'__MACOSX*\''
      const zipExtractDir = `-d ${this._changeToDir}`
      unpack = `${this._unzip.path} -o ${this._path} ${zipExcludes} ${zipExtractDir}`
    } else if (this._isRarFile) {
      // RAR .rar
      unpack = `${this._unrar.path} e -ad ${this._path} ${this._changeToDir}`
    } else {
      error(`this._isTarFile: ${this._isTarFile} (compressed? ${this._isCompressed}`)
      error(`this._isRarFile: ${this._isRarFile}`)
      error(`this._isGzipFile: ${this._isGzipFile}`)
      error(`this._isGzipFile: ${this._isZipFile}`)
      throw new Error(`Not an archive? ${this._path}`)
    }
    let result
    let stats
    // let tempDir
    destination = nodePath.resolve(destination)
    /* eslint-disable-next-line no-useless-escape */
    destination = destination.replace(/(.*[^\/])$/, '$1/')
    try {
      log(`unpack command: ${unpack}`)
      log(`destination: ${destination}`)
      result = await cmd(unpack)
      log('result: ', result)
      if (result.stderr !== '' && result.stdout === '') {
        throw new Error(result.stderr)
      }
    } catch (e) {
      error(e)
      const cause = e
      throw new Error('Failed trying to move unpacked file(s)', { cause })
    }
    try {
      // if (this._isTarFile || this._isRarFile || this._isZipFile) {
      if (this._isTarFile || this._isRarFile) {
        this._tempDir = `${this._changeToDir}${this._fileBasename}`
      } else if (this._isZipFile) {
        // ZIP file
        this._tempDir = `${this._changeToDir}${this._fileBasename}`
      } else {
        // Gzip files extract into the directory they are in, not into
        // the process.cwd context of the excuting script.
        this._tempDir = `${this._file.dir}/${this._fileBasename}`
      }
      log(`tempDir:           ${this._tempDir}`)
      log(`destination:       ${destination}${this._fileBasename}`)
      log(`this._destination: ${nodePath.resolve(this._destination, this._fileBasename)}`)
      stats = await fs.stat(this._tempDir)
      if (stats.isDirectory()) {
        result.unpacked = true
        result.cwd = this._tempDir
      } else if (stats.isFile()) {
        // Gzipped single file extraction
        result.unpacked = true
        result.cwd = this._tempDir
        // modify destination to include dir named after file basename
        /* eslint-disable-next-line no-useless-escape */
        destination += `${this._fileBasename.replace(/^(\w+?[^\.]*)((\.?)\w+)?$/, '$1')}/`
      }
      if (rename?.rename) {
        log(`renaming ${this._file.name} -> ${rename.newName}`)
        try {
          const renamed = await this.rename(this._tempDir, rename.newName)
          this._file.name = rename.newName
          result.destination = renamed.destination
          result.command = renamed.command
          result.cwd = renamed.destination
          result.finalPath = renamed.destination
        } catch (e) {
          error(e)
          throw new Error('Failed to rename desintation.', { cause: e })
        }
      } else {
        result.destination = destination
        // result.finalPath = `${destination}${this._file.name}`
        result.finalPath = `${destination}${this._fileBasename}`
      }
      log('move opts: ', options)
      if (this._tempDir !== `${destination}${this._fileBasename}`) {
        const move = await this.mv(this._tempDir, destination, options)
        log('did the mv command work?', move)
      }
      log('result contents: ', result)
      log('about to call mv with:')
      log(`result._tempDir: ${this._tempDir}`)
      log(`destination: ${destination}`)
    } catch (e) {
      error(e)
      const msg = `Error ocurred trying to move ${this._tempDir} to ${destination}`
      // const cause = new Error(`Error ocurred trying to move ${this._tempDir} to ${destination}`)
      throw new Error(msg, { cause: e })
    }
    try {
      await this.cleanup('__MACOSX')
      await this.cleanup(`._${this._file.name}`)
    } catch (e) {
      error(e)
    }
    result.command = unpack
    log(`_destination: ${this._destination}`)
    log('final unpack results: ', result)
    return result
  }

  /*
   * Rename an existing directory to a new name.
   * @summary Rename an existing directory to a new name.
   * @async
   * @param { string } oldPath - The original name.
   * @param { string } newPath - the new name to be used.
   * @param { Object } options - Object literal with command line options for the mv command.
   * @param { boolean } options.force - Whether to cause mv command to overwrite an existing destination path.
   * @param { string } optsions.backup - Tell mv command whether or not to backup existing destination path, if supported.
   * @throw { Error }
   * @return { boolean } True if rename operation was successful.
   */
  async rename(oldPath, newPath, options = null) {
    const log = _log.extend('rename')
    const error = _error.extend('rename')
    if (!oldPath) throw new Error('Missing source argument')
    if (!newPath) throw new Error('Missing destination argument')
    const opts = { force: true, backup: 'numbered', ...options }
    if (this._platform === 'darwin') {
      opts.backup = false
    }
    log('rename opts: %o', opts)
    log(`${oldPath} ${newPath}`)
    log('pre-rename this._destination: ', this._destination)
    let result
    try {
      const parsedPath = nodePath.parse(nodePath.resolve(newPath))
      result = await cmd(`mkdir -p ${parsedPath.dir}`)
      // finish this part - make missing parent dirs on renaming destination
      // mv tmp/marquetry --> albums/<001>/marquetry
      // figure out how to add the <001> part
    } catch (e) {
      error('Renamed destination failed to make missing parent directories.')
      error(e)
      throw new Error('Missing parent dirs for renamed destination.', { cause: e })
    }
    try {
      // const fullDestination = `${oldPath}${(this._tempDir.split('/').splice(-1, 1))[0]}`
      const fullDestination = this._tempDir
      const splitDestination = oldPath.split('/')
      splitDestination.splice(-1, 1, newPath)
      const renamedDestination = splitDestination.join('/')
      const mv = `mv ${(opts.force ? '-f' : '')} ${(opts.backup === 'numbered' ? '--backup=numbered' : '')} ${fullDestination} ${renamedDestination}`
      log(`mv: ${mv}`)
      result = await cmd(mv)
      result.command = mv
      result.destination = renamedDestination
      log('renamed destination: ', result)
      // this._destination = renamedDestination
      this._tempDir = renamedDestination
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    return result
  }

  /**
   * Move the newly unpacked contents of the archive file to the given destination.
   * @summary Move the newly unpacked contents of the archive to the given destination.
   * @author Matthew Duffy <mattdufy@gmail.com>
   * @async
   * @param { string } source - The directory to move.
   * @param { string } destination - The file system location to move the archive contents.
   * @param { Object } options - Object literal with options for mv command.
   * @param { boolean } options.makeDir - Boolean controlling if parent dirs need to be created.
   * @throws { Error } Throws an error if the contents cannot be moved.
   * @return { boolean } True if move is successful.
   */
  async mv(source, destination, options = null) {
    const log = _log.extend('mv')
    const error = _error.extend('mv')
    if (!source) throw new Error('Missing source argument')
    if (!destination) throw new Error('Missing destination argument')
    const opts = { makeDir: true, ...options }
    log('opts: %o', opts)
    log(`${source} ${destination}`)
    try {
      const sourceStats = await fs.stat(source)
      log(`isDir: ${sourceStats.isDirectory()}`)
    } catch (e) {
      error(e)
      throw new Error(`Source missing directory: ${source}`)
    }
    let destinationDoesntExist = true
    let destinationStats
    try {
      destinationStats = await fs.stat(destination)
    } catch (e) {
      destinationDoesntExist = false
      const mkdir = `mkdir -v -p ${destination}`
      log(`destinationDoesntExist: ${destinationDoesntExist}`)
      log(`mkdir: ${mkdir}`)
      const result = await cmd(mkdir)
      if (result.stderr.trim() !== '') {
        error(`Failed to make dir: ${destination}`)
        throw new Error(`Failed to make dir: ${destination}`)
      }
    }
    try {
      destinationStats = await fs.stat(destination)
      if (destinationStats.isDirectory() && !opts.force) {
        error(`Destination already exists, no over-writing:  ${destination}`)
        throw new Error(`Destination already exists, no over-writing:  ${destination}`)
      }
      const mv = `mv ${(opts.force ? '-f' : '')} ${(opts.backup === 'numbered' ? '--backup=numbered' : '')} ${source} ${destination}`
      log(`mv: ${mv}`)
      const result = await cmd(mv)
      log(result)
      if (result.stderr !== '') {
        error(`Move failed. source: ${source} destination: ${destination}`)
        throw new Error(`Move failed. source: ${source} destination: ${destination}`)
      }
    } catch (e) {
      error(e)
      const cause = new Error(e.message)
      throw new Error('Move failed. Cause: ', { cause })
    }
    this._destination = destination
    log(this._destination)
    return true
  }

  /**
   * List the contents of a Tar file.
   * @summary List the contents of a Tar file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } tarFile - A string containing the name of the Tar file.
   * @throws { Error } Throws an error if the contents of the Tar file cannont be listed.
   * @return { Object[] } An object literal with an array of file names.
   */
  async list(file = this._path) {
    const log = _log.extend('list')
    const error = _error.extend('list')
    let list
    log(this._isTarFile)
    try {
      if (this._isTarFile) {
        list = this.tar_t(file)
      }
      if (this._isRarFile) {
        list = this.unrar_lb(file)
      }
      if (this._isGzipFile && !this._isTarFile) {
        list = this.gunzip_l(file)
      }
      if (this._isZipFile) {
        list = this.unzip_l(file)
      }
    } catch (e) {
      error(e)
      const cause = e
      throw new Error(`Failed to list contents of archive: ${file}`, { cause })
    }
    return list
  }

  /**
   * List the contents of a Tar file.  Called by the proxy method, list().
   * @summary List the contents of a Tar file.  Called by the proxy method, list().
   * @see list
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } tarFile - A string containing the name of the Tar file.
   * @throws { Error } Throws an error if the contents of the Tar file cannot be listed.
   * @return { Object[] } An object literal with an array of the file names.
   */
  async tar_t(tarFile = this._path) {
    const log = _log.extend('tar_t')
    const error = _error.extend('tar_t')
    log(tarFile)
    const o = {}
    try {
      const excludes = '--exclude=__MACOSX --exclude=._* --exclude=.svn --exclude=.git*'
      const tar = `tar ${excludes} --list ${(this._isCompressed ? '-z' : '')} -f`
      log(`cmd: ${tar} ${tarFile}`)
      o.cmd = `${tar} ${tarFile}`
      const result = await cmd(`${tar} ${tarFile}`)
      log(result.stdout)
      const list = result.stdout.trim().split('\n')
      o.list = list
    } catch (e) {
      error(e)
      throw new Error(`Couldn't Tar tail the archive ${tarFile}`)
    }
    return o
  }

  /**
   * List the contents of a Rar file.  Called by the proxy method, list().
   * @summary List the contents of a Rar file.  Called by the proxy method, list().
   * @see list
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } rarFile - A string containing the name of the Rar file.
   * @throws { Error } Throws an error if the contents of the Tar file cannot be listed.
   * @return { Object[] } An object literal with an array of the file names.
   */
  async unrar_lb(rarFile = this._path) {
    const log = _log.extend('rar_lb')
    const error = _error.extend('rar_lb')
    log(rarFile)
    const o = {}
    try {
      // const excludes = 'xMACOSX x._* x.svn x.git*'
      const excludes = ''
      const unrar = `unrar ${excludes} lb`
      log(`cmd: ${unrar} ${rarFile}`)
      o.cmd = `${unrar} ${rarFile}`
      console.log(o)
      const result = await cmd(`${unrar} ${rarFile}`)
      log(result.stdout)
      const list = result.stdout.trim().split('\n')
      o.list = list
    } catch (e) {
      error(e)
      throw new Error(`Couldn't Rar list the archive ${rarFile}`)
    }
    return o
  }

  /**
   * List the single file contents of a Gzip file.  Called by the proxy method, list().
   * @summary List the single file contents of a Gzip file.  Called by the proxy method, list().
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @see list
   * @async
   * @param { string } gzFile - A string containing the name of the Gzip file.
   * @throws { Error } Throws an error if the contents of the Gzip file cannot be listed.
   * @return { Object } An object literal with the file name.
   */
  async gunzip_l(gzFile = this._file) {
    const log = _log.extend('gunzip_l')
    const error = _error.extend('gunzip_l')
    log(gzFile)
    const o = {}
    try {
      const gunzip = 'gunzip -l --quiet'
      log(`cmd: ${gunzip} ${gzFile}`)
      o.cmd = `${gunzip} ${gzFile}`
      const result = await cmd(`${gunzip} ${gzFile}`)
      log(result)
      const list = result.stdout.trim().split('\n')
      /* eslint-disable-next-line no-useless-escape */
      const pattern = '^.*\/(.+)$'
      const re = new RegExp(pattern)
      list.forEach((e, i) => {
        log(pattern)
        list[i] = e.replace(re, '$1')
      })
      o.list = list
    } catch (e) {
      error(e)
      throw new Error(`Couldn't Gunzip list the archive contents ${gzFile}`)
    }
    return o
  }

  /**
   * List the contents of a Zip file.  Called by the proxy method, list().
   * @summary List the contents of a Zip file.  Called by the proxy method, list().
   * @see list
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } zipFile - A string containing the name of the Zip file.
   * @throws { Error } Throws an errof if the contents of the Zip file cannot be listed.
   * @return { Object[] } An object literal with an array of the file names.
   */
  async unzip_l(zipFile = this._path) {
    const log = _log.extend('unzip_l')
    const error = _error.extend('unzip_l')
    log(zipFile)
    const o = {}
    try {
      // const unzip = 'unzip -qql '
      const unzip = 'unzip -Z -1 '
      const excludes = '-x __MACOSX*'
      log(`cmd: ${unzip} ${zipFile} ${excludes}`)
      o.cmd = `${unzip} ${zipFile} ${excludes}`
      const result = await cmd(`${unzip} ${zipFile} ${excludes}`)
      log(result.stdout)
      const list = result.stdout.trim().split('\n').slice(1)
      /* eslint-disable-next-line no-useless-escape */
      const pattern = `^.*${this._fileBasename}\\/(.+)$`
      const re = new RegExp(pattern)
      list.forEach((e, i) => {
        log(pattern)
        list[i] = e.replace(re, '$1')
      })
      o.list = list
    } catch (e) {
      error(e)
      throw new Error(`Couldn't Unzip list the archive ${zipFile}`)
    }
    return o
  }

  /**
   * Clean up after the unpacking, delete any weird artifacts like __MACOSX resource things.
   * @summary Clean up after the unpacking, delete any weird artifacts like __MACOSX resource things.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } artifact - String name of something to look for after unpacking, to be deleted.
   * @return { undefined }
   */
  async cleanup(artifact) {
    const log = _log.extend('cleanup')
    const error = _error.extend('cleanup')
    const x = `${this._cwd}/${artifact}`
    try {
      const rm = `rm -rf ${x}`
      await cmd(rm)
      log(`cleanup cmd: ${rm}`)
      log('cleanup ok')
    } catch (e) {
      error(e)
    }
  }
}
