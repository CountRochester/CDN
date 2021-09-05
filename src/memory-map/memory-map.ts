export interface Address {
  start: number
  end: number
}

export interface FileAddress {
  path: string
  start: number
  end: number
}

export interface FileElement {
  path: string
  content: Buffer
}

export interface MemoryMapOptions {
  files: FileElement[]
  capacity: number
}

export class MemoryMap {
  #map: Map<string, Address>

  #capacity: number

  #currentSize: number

  /**
   * @param options.files - array of file objects with paths
   * @param options.capacity - capacity of file storage in bytes
   */
  constructor (options: MemoryMapOptions) {
    this.#capacity = options.capacity
    this.#currentSize = 0
    this.#map = new Map()
    options.files.forEach(file => {
      if ((this.#currentSize + file.content.length) >= this.#capacity) {
        return
      }
      this.#map.set(file.path, {
        start: this.#currentSize,
        end: this.#currentSize + file.content.length
      })
      this.#currentSize += file.content.length
    })
  }

  get size (): number {
    return this.#currentSize
  }

  get capacity (): number {
    return this.#capacity
  }

  get length (): number {
    return this.#map.size
  }

  /**
   * Returns the file's address
   * @param path path of the file
   */
  getFileAddress (path: string): Address|undefined {
    return this.#map.get(path)
  }

  /**
   * Adds the file to the map
   * @param file new file element
   */
  addFile (file: FileElement): void {
    if ((file.content.length + this.#currentSize) >= this.#capacity) {
      throw new Error('The map is full')
    }
    const existedFile = this.#map.get(file.path)
    if (existedFile) {
      throw new Error(`The path: ${file.path} is in use`)
    }
    this.#map.set(file.path, {
      start: this.#currentSize,
      end: this.#currentSize + file.content.length
    })
    this.#currentSize += file.content.length
  }

  /**
   * Returns all the files addresses
   */
  getAll (): FileAddress[] {
    const output: FileAddress[] = []
    this.#map.forEach((value, key) => {
      output.push({
        path: key,
        start: value.start,
        end: value.end
      })
    })
    return output
  }
}
