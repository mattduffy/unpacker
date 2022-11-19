/**
 * @module @mattduffy/unpacker
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file index.js The Unpacker class definition file.
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
    this._path = pathToArchiveFile || null
    this._file = null
    this._mimetype = null
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
   * @return { undefind|Error } Throws an error if path argument is not provided or if path is not valid.
   */
  async setPath(filePath) {
    if (!filePath) {
      throw new Error('Missing required path argument.')
    }
    try {
      if (this._tar === null) {
        await this.whichTar()
      }
      if (this._gzip === null) {
        await this.whichGzip()
      }
      if (this._unzip === null) {
        await this.whichUnzip()
      }
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw new Error(`Not a file: ${filePath}`)
      } else {
        this._path = nodePath.resolve(filePath)
        await this.setMimetype(this._path)
        this._file = nodePath.parse(this._path)
        return
      }
    } catch (e) {
      throw new Error(`Not a valid file path: ${filePath}`)
    }
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
   * @return { undefined }
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
  }

  /**
   * Find the location of the tar executable.
   * @summary Find the location of the tar executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for tar fails.
   * @return { undefined }
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
   * @return { undefined }
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
   * @returns { undefined }
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
   * @return { Object } An object literal with success or error messages.
   */
  checkCommands() {
    if (this._tar === null) {
      this.whichTar()
    }
    if (this._gzip === null) {
      this.whichGzip()
    }
    if (this._unzip === null) {
      this.whichUnzip()
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
   * @throws { Error } Throws an error if the archive could not be unpacked.
   * @return { Object } An object literal with success or error messages.
   */
  async unpack(moveTo) {
    let destination = moveTo || '.'
    if (this._tar === null && this._mimetype === TAR) {
      throw new Error(`Archive is ${this._mimetype}, but can't find tar executable.`)
    }
    if (this.gzip === null && this._mimetype === GZIP) {
      throw new Error(`Archive is ${this._mimetype}, but can't find gzip executable.`)
    }
    let unpack
    if (this._mimetype === TAR) {
      unpack = `${this._tar.path} xf ${this._path}`
    } else if (this._mimetype === GZIP) {
      // check if file is a tarball: .tar.gz or .tgz
      if (/t(ar\.)?gz$/.test(this._file.base)) {
        unpack = `${this._tar.path} xzf ${this._path}`
      } else {
        // file is probably a .gz or .zip
        unpack = `${this._gzip.path} -d -S ${this._file.ext} ${this._path}`
      }
    } else if (this._mimetype === ZIP) {
      unpack = `${this._unzip.path} ${this._path}`
    } else {
      throw new Error(`Not an archive? ${this._path}`)
    }
    let result
    let stats
    let tempDir
    destination = nodePath.resolve(destination)
    try {
      debug(`unpack: ${unpack}`)
      result = await cmd(unpack)
      debug(result)
      if (result.stderr !== '') {
        throw new Error(result.stderr)
      }
      /**
       * @todo - if .tar.gz - have to remove the .tar from the file basename - do this futher up where this._file is set.
       * @todo - move the unpacked directory to the @param destination.
       */
      tempDir = `${this._cwd}/${this._file.name}`
      stats = await fs.stat(tempDir)
      if (!stats.isDirectory()) {
        result.unpacked = null
        result.location = null
      }
      result.destination = destination
      result.unpacked = true
      result.location = tempDir
    } catch (e) {
      debug(e)
      throw new Error(e)
    }
    return result
  }
}
