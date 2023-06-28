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
const debug = Debug('unpacker:class')
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
    this._isGzipFile = false
    this._isZipFile = false
    this._isCompressed = false
    this._tar = null
    this._gzip = null
    this._unzip = null
    this._cwd = process.cwd()
    this.__dirname = __dirname
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
      if (this._gzip === null) {
        await this.whichGzip()
      }
    } catch (e) {
      throw new Error('Failed to find gzip.')
    }
    try {
      if (this._unzip === null) {
        await this.whichUnzip()
      }
    } catch (e) {
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
      throw new Error(`Not a valid file path: ${filePath}`)
    }
    try {
      this.setExtension(filePath)
    } catch (e) {
      throw new Error(`File extension problem: ${filePath}`)
    }
    try {
      this.setFileBasename(filePath)
    } catch (e) {
      throw new Error(`File basename problem: ${filePath}`)
    }
    return undefined
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
    try {
      const result = await cmd(`file --mime-type --brief '${file}'`)
      const mime = result.stdout.trim()
      debug(result)
      debug(`${file}: ${mime}`)
      switch (result.stdout.trim()) {
        case TAR:
          this._mimetype = TAR
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
    const ext = /\.*(\.(t(ar)?(\.?gz)?)|(zip)?|(gz)?)$/.exec(file)
    if (ext === null) {
      throw new Error(`File ${file} does not look like a (compressed) archive file.`)
    }
    debug(`file extension: ${ext[0]}`)
    if (this._mimetype === ZIP) {
      this._isCompressed = true
      this._isZipFile = true
      this._isGzipFile = false
      this._isTarFile = false
    }
    if (this._mimetype === GZIP) {
      this._isCompressed = true
      this._isGzipFile = true
      this._isZipFile = false
      this._isTarFile = false
    }
    if (/\.?tar$/.test(ext[0])) {
      this._isTarFile = true
      this._isCompressed = false
      this._isZipFile = false
      this._isGzipFile = false
    }
    if (['.tar.gz', '.tgz'].includes(ext[0])) {
      this._isCompressed = true
      this._isTarFile = true
      this.isGzipFile = true
      this._isZipFile = false
    }
    [this._fileExt] = ext
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
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${tar.path} --version | awk '/([0-9]\.[0-9]+)$/ { print $NF}'`)
      tar.version = version.stdout.trim()
    } catch (e) {
      throw new Error(e)
    }
    this._tar = tar
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
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${gzip.path} --version | awk '/([0-9]+\.[0-9]+)$/ { print $NF }'`)
      gzip.version = version.stdout.trim()
    } catch (e) {
      throw new Error(e)
    }
    this._gzip = gzip
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
      throw new Error(e)
    }
    try {
      /* eslint-disable-next-line no-useless-escape */
      const version = await cmd(`${unzip.path} -v | awk '/^[Uu]n[Zz]ip ([0-9]+\.[0-9]+)/ { print $2 }'`)
      unzip.version = version.stdout.trim()
    } catch (e) {
      throw new Error(e)
    }
    this._unzip = unzip
  }

  /**
   * Check for the presence of usable versions of tar and gzip.
   * @summary Check for the presence of usuable versions of tar and gzip.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Object } An object literal with success or error messages.
   */
  async checkCommands() {
    if (this._tar === null) {
      await this.whichTar()
    }
    if (this._gzip === null) {
      await this.whichGzip()
    }
    if (this._unzip === null) {
      await this.whichUnzip()
    }
    return { tar: this._tar, gzip: this._gzip, unzip: this._unzip }
  }

  /**
   * Unpack the archive file.  The archive file may be one of these file formats: .tar, .tar.gz, .tgz, .zip, or .gzip.
   * The contents of the archive are extracted into a folder, named after the archive, in its current directory.
   * @summary Extract the contents of the archive into a directory, with the name of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } moveTo - A file system location to move the unpacked archive to.
   * @param { Object } opts - An object literal with options for mv command.
   * @param { Object } rename - An object literal with new name for destination directory.
   * @param { boolean } rename.rename - Should the destination directory be renamed.
   * @param { string } rename.newName - Destination renamed to this.
   * @throws { Error } Throws an error if the archive could not be unpacked.
   * @return { Object } An object literal with success or error messages.
   */
  async unpack(moveTo, opts, rename) {
    let destination = moveTo ?? '.'
    const options = { force: true, backup: 'numbered', ...opts }
    debug(`process.platform: ${process.platform}`)
    if (process.platform === 'darwin') {
      options.backup = false
    }
    if (this._tar === null && this._mimetype === TAR) {
      throw new Error(`Archive is ${this._mimetype}, but can't find tar executable.`)
    }
    if (this.gzip === null && this._mimetype === GZIP) {
      throw new Error(`Archive is ${this._mimetype}, but can't find gzip executable.`)
    }
    let unpack
    const tarExcludes = '--exclude=__MACOSX* --exclude=._* --exclude=.git* --exclude=.svn*'
    if (this._isTarFile && !this._isCompressed) {
      // TAR .tar
      unpack = `${this._tar.path} ${tarExcludes} -xf ${this._path}`
    } else if (this._isTarFile && this._isGzipFile) {
      // Compressed TAR .tar.gz or .tgz
      unpack = `${this._tar.path} ${tarExcludes} -xzf ${this._path}`
    } else if (this._isGzipFile && this._isCompressed) {
      // GZIP file is probably a .gz
      unpack = `${this._gzip.path} --decompress --keep --suffix ${this._file.ext} ${this._path}`
    } else if (this._isZipFile) {
      // ZIP .zip
      const zipExcludes = '-x \'__MACOSX*\''
      unpack = `${this._unzip.path} ${this._path} ${zipExcludes}`
    } else {
      throw new Error(`Not an archive? ${this._path}`)
    }
    let result
    let stats
    let tempDir
    destination = nodePath.resolve(destination)
    /* eslint-disable-next-line no-useless-escape */
    destination = destination.replace(/(.*[^\/])$/, '$1/')
    try {
      debug(`unpack: ${unpack}`)
      debug(`destination: ${destination}`)
      result = await cmd(unpack)
      debug(result)
      if (result.stderr !== '' && result.stdout === '') {
        throw new Error(result.stderr)
      }
    } catch (e) {
      debug(e)
      const cause = e
      throw new Error('Failed trying to move unpacked file(s)', { cause })
    }
    try {
      if (this._isTarFile || this._isZipFile) {
        tempDir = `${this._cwd}/${this._fileBasename}`
      } else {
        // Gzip files extract into the directory they are in, not into
        // the process.cwd context of the excuting script.
        tempDir = `${this._file.dir}/${this._fileBasename}`
      }
      debug(`tempDir: ${tempDir}`)
      stats = await fs.stat(tempDir)
      if (stats.isDirectory()) {
        result.unpacked = true
        result.cwd = tempDir
      } else if (stats.isFile()) {
        // Gzipped single file extraction
        result.unpacked = true
        result.cwd = tempDir
        // modify destination to include dir named after file basename
        /* eslint-disable-next-line no-useless-escape */
        destination += `${this._fileBasename.replace(/^(\w+?[^\.]*)((\.?)\w+)?$/, '$1')}/`
      }
      const move = await this.mv(tempDir, destination, options)
      result.destination = destination
      debug(move)
    } catch (e) {
      const cause = new Error(`Error ocurred trying to move ${tempDir} to ${destination}`)
      throw new Error(e, { cause })
    }
    try {
      await this.cleanup('__MACOSX')
      await this.cleanup(`._${this._file.name}`)
    } catch (e) {
      debug(e)
    }
    if (rename?.rename) {
      try {
        const fullDestination = `${destination}${(tempDir.split('/').splice(-1, 1))[0]}`
        const splitDestination = destination.split('/')
        splitDestination.splice(-1, 1, rename.newName)
        const renamedDestination = splitDestination.join('/')
        const renamed = await fs.rename(fullDestination, renamedDestination)
        debug(`renamed destination: ${(renamed === undefined)}`)
        this._destination = renamedDestination
        result.destination = renamedDestination
        debug(this._destination)
      } catch (e) {
        debug(e)
        throw new Error(e)
      }
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
    if (!source) throw new Error('Missing source argument')
    if (!destination) throw new Error('Missing destination argument')
    const opts = { makeDir: true, ...options }
    debug('opts: %o', opts)
    debug(`${source} ${destination}`)
    try {
      const sourceStats = await fs.stat(source)
      debug(`isDir: ${sourceStats.isDirectory()}`)
    } catch (e) {
      throw new Error(`Source missing directory: ${source}`)
    }
    let destinationDoesntExist = true
    let destinationStats
    try {
      destinationStats = await fs.stat(destination)
    } catch (e) {
      destinationDoesntExist = false
      const mkdir = `mkdir -v -p ${destination}`
      debug(`destinationDoesntExist: ${destinationDoesntExist}`)
      debug(`mkdir: ${mkdir}`)
      const result = await cmd(mkdir)
      if (result.stderr.trim() !== '') {
        throw new Error(`Failed to make dir: ${destination}`)
      }
    }
    try {
      destinationStats = await fs.stat(destination)
      if (destinationStats.isDirectory() && !opts.force) {
        throw new Error(`Destination already exists, no over-writing:  ${destination}`)
      }
      const mv = `mv ${(opts.force ? '-f' : '')} ${(opts.backup === 'numbered' ? '--backup=numbered' : '')} ${source} ${destination}`
      debug(`mv: ${mv}`)
      const result = await cmd(mv)
      debug(result)
      if (result.stderr !== '') {
        throw new Error(`Move failed. source: ${source} destination: ${destination}`)
      }
    } catch (e) {
      const cause = new Error(e.message)
      throw new Error('Move failed. Cause: ', { cause })
    }
    this._destination = destination
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
    let list
    debug(this._isTarFile)
    try {
      if (this._isTarFile) {
        list = this.tar_t(file)
      }
      if (this._isGzipFile && !this._isTarFile) {
        list = this.gunzip_l(file)
      }
      if (this._isZipFile) {
        list = this.unzip_l(file)
      }
    } catch (e) {
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
    debug(tarFile)
    const o = {}
    try {
      const excludes = '--exclude=__MACOSX --exclude=._* --exclude=.svn --exclude=.git*'
      const tar = `tar ${excludes} -t${(this._isCompressed ? 'z' : '')}f`
      debug(`cmd: ${tar} ${tarFile}`)
      o.cmd = `${tar} ${tarFile}`
      const result = await cmd(`${tar} ${tarFile}`)
      debug(result.stdout)
      const list = result.stdout.trim().split('\n')
      o.list = list
    } catch (e) {
      throw new Error(`Couldn't Tar tail the archive ${tarFile}`)
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
    debug(gzFile)
    const o = {}
    try {
      const gunzip = 'gunzip -l --quiet'
      debug(`cmd: ${gunzip} ${gzFile}`)
      o.cmd = `${gunzip} ${gzFile}`
      const result = await cmd(`${gunzip} ${gzFile}`)
      debug(result)
      const list = result.stdout.trim().split('\n')
      /* eslint-disable-next-line no-useless-escape */
      const pattern = '^.*\/(.+)$'
      const re = new RegExp(pattern)
      list.forEach((e, i) => {
        debug(pattern)
        list[i] = e.replace(re, '$1')
      })
      o.list = list
    } catch (e) {
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
    debug(zipFile)
    const o = {}
    try {
      // const unzip = 'unzip -qql '
      const unzip = 'unzip -Z -1 '
      const excludes = '-x __MACOSX*'
      debug(`cmd: ${unzip} ${zipFile} ${excludes}`)
      o.cmd = `${unzip} ${zipFile} ${excludes}`
      const result = await cmd(`${unzip} ${zipFile} ${excludes}`)
      debug(result.stdout)
      const list = result.stdout.trim().split('\n').slice(1)
      /* eslint-disable-next-line no-useless-escape */
      const pattern = `^.*${this._fileBasename}\\/(.+)$`
      const re = new RegExp(pattern)
      list.forEach((e, i) => {
        debug(pattern)
        list[i] = e.replace(re, '$1')
      })
      o.list = list
    } catch (e) {
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
    const x = `${this._cwd}/${artifact}`
    try {
      await cmd(`rm -rf ${x}`)
    } catch (e) {
      debug(e)
    }
  }
}
