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
    this._fileExt = null
    this._fileList = null
    this._isTarFile = null
    this._isCompressed = null
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
        this.setExtension(filePath)
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
   * Set the file extension of the archive file name.
   * @summary Get the file extension of the archive file name.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @param { string } file - A file system path to the file.
   * @throws { Error } Throws an errof if the file path is invalid.
   * @returns { undefined }
   */
  setExtension(file = this._file) {
    const ext = /\.*(\.(t(ar)?(\.?gz)?)|(zip)?|(gz)?)$/.exec(file)
    if (ext === null) {
      throw new Error(`File ${file} does not look like a (compressed) archive file.`)
    }
    debug(`file extension: ${ext[0]}`)
    if (['.tar', '.tar.gz', '.tgz'].includes(ext[0])) {
      this._isTarFile = true
    }
    if (this._mimetype === ZIP || this._mimetype === GZIP) {
      this._isCompressed = true
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
   * @param { object } options - An object literal with options for mv command.
   * @throws { Error } Throws an error if the archive could not be unpacked.
   * @return { Object } An object literal with success or error messages.
   */
  async unpack(moveTo, opts) {
    let destination = moveTo || '.'
    const options = { force: true, backup: 'numbered', ...opts }
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
    /* eslint-disable-next-line no-useless-escape */
    destination = destination.replace(/(.*[^\/])$/, '$1/')
    try {
      debug(`unpack: ${unpack}`)
      result = await cmd(unpack)
      debug(result)
      if (result.stderr !== '') {
        throw new Error(result.stderr)
      }
      this._file.name = this._file.name.replace(/\.tar$/, '')
      tempDir = `${this._cwd}/${this._file.name}`
      stats = await fs.stat(tempDir)
      if (!stats.isDirectory()) {
        result.unpacked = null
        result.cwd = null
      }
      result.unpacked = true
      result.cwd = tempDir
      try {
        const mv = `mv ${(options.force ? '-f' : '')} ${(options.backup === 'numbered' ? '--backup=numbered' : '')} ${tempDir} ${destination}`
        const move = await cmd(mv)
        result.destination = destination
        debug(move)
      } catch (e) {
        const cause = new Error(`Error ocurred trying to move ${tempDir} to ${destination}`)
        throw new Error(e, { cause })
      }
    } catch (e) {
      debug(e)
      throw new Error(e)
    }
    try {
      await this.cleanup('__MACOSX')
      await this.cleanup(`._${this._file.name}`)
    } catch (e) {
      debug(e)
    }
    return result
  }

  /**
   * List the contents of a Tar file.
   * @summary List the contents of a Tar file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } tarFile - A string containing the name of the Tar file.
   * @throws { Error } Throws an error if the contents of the Tar file cannont be listed.
   * @return { Object } An object literal with an array of file names.
   */
  async list(tarFile = this._path) {
    debug(tarFile)
    const o = {}
    try {
      const tar = `tar t${(this._isCompressed ? 'z' : '')}f `
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
