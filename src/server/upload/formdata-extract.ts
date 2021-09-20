/*
  New block starts here:
    ---------------------------- (28 -)
    549315553513576565954746 (number 24 digits)
    \r\n (0D 0A)
  if is a key:
    Content-Disposition: form-data; name="KEY_NAME"
    \r\n\r\n
    KEY_VALUE
  if is a file:
    Content-Disposition: form-data; name="KEY_NAME"; filename="FILE_NAME"
    \r\n
    Content-Type: MIME_TYPE
    \r\n\r\n
    CONTENT
  encoding:
*/

/*
  Content-Disposition: form-data; name="token"
    \r\n\r\n
    KEY_VALUE
  Content-Disposition: form-data; name="destination"
    \r\n\r\n
    KEY_VALUE
*/

const nameRegExp = /(?<= name=")([\s\S]+?)(?=")/gm
const filenameRegExp = /(?<= filename=")([\s\S]+?)(?=")/gm

type FileIndex = {
  start: number,
  end: number
}

type ParsedFileMetadata = {
  name: string
  filename?: string
  contentType?: string
}

type ParsedElement = {
  name: string
  filename?: string
  contentType?: string
  value: string | Buffer
}

type FormDataKey = {
  name: string
  value: string
}

type FormDataFile = {
  name: string
  filename: string
  contentType: string
  value: Buffer
}

const METADATA_TEST_VALUE = 'Content-Disposition: form-data;'

export function getChar (bufEl: number): string {
  return String.fromCharCode(bufEl)
}

/**
 * Returns the buffer from divider
 * @param buffer - buffer to search the divider
 */
export function getDividerFromBuffer (buffer: Buffer): Buffer {
  let end = false
  const divider = []
  let i = 0
  while (!end) {
    divider.push(getChar(buffer[i]))
    if (getChar(buffer[i]) === '\r' && getChar(buffer[i + 1]) === '\n') {
      divider.push(getChar(buffer[i + 1]))
      end = true
    }
    i++
  }
  const output = Buffer.from(divider.join(''))
  return output
}

/**
 * Returns the array of file content indexes from the buffer
 * @param buffer - to search the file content
 * @param divider - the divider of the files
 */
export function getElementIndexes (buffer: Buffer, divider: Buffer): FileIndex[] {
  const startIndexes: number[] = []
  let j = 0
  for (let i = 0; i < buffer.length; i++) {
    if (j === divider.length) {
      j = 0
      startIndexes.push(i)
    }
    if (buffer[i] === divider[j]) {
      j++
    } else {
      j = 0
    }
    if (i === divider.length && !startIndexes.length) {
      startIndexes.push(0)
    }
  }
  const output = startIndexes.map((el, index) => {
    const end = startIndexes[index + 1]
      ? startIndexes[index + 1] - divider.length - 3
      : buffer.length - divider.length - 5
    return {
      start: el,
      end
    }
  })
  return output
}

/**
 * Splits the input buffer by the array of indexes and returns the array of files (Buffers)
 * @param buffer - input buffer
 * @param indexes - array of file indexes
 */
export function splitBuffer (buffer: Buffer, indexes: FileIndex[]): Buffer[] {
  const output: Buffer[] = []
  indexes.forEach((el) => {
    const subBuf = buffer.slice(el.start, el.end + 1)
    output.push(subBuf)
  })
  return output
}

/**
 * Extract files data from the input buffer
 * @param buffer - buffer contains the files data and dividers
 */
export function formData (buffer: Buffer): Buffer[] {
  const divider = getDividerFromBuffer(buffer)
  const indexes = getElementIndexes(buffer, divider)
  const filesData = splitBuffer(buffer, indexes)
  return filesData
}

/**
 * Checks if the metadata is valid. The valid metadata should starts from
 * 'Content-Disposition: form-data;'
 * @param metadata - string, containing the metadata
 */
export function isValidData (metadata: string): boolean {
  const valueToTest = metadata.slice(0, METADATA_TEST_VALUE.length)
  return valueToTest === METADATA_TEST_VALUE
}

/**
 * Retrieves the metadata from the file data
 * @param elData - the element data to extract the metadata
 */
export function getMetaDataFromBuffer (elData: Buffer): { metadata: string, complete: boolean } {
  let end = false
  const metadata = []
  let i = 0
  while (!end && (i < elData.length)) {
    metadata.push(getChar(elData[i]))
    if (getChar(elData[i]) === '\r'
      && getChar(elData[i + 1]) === '\n'
      && getChar(elData[i + 2]) === '\r'
      && getChar(elData[i + 3]) === '\n') {
      metadata.push(getChar(elData[i + 1]))
      metadata.push(getChar(elData[i + 2]))
      metadata.push(getChar(elData[i + 3]))
      end = true
    }
    i++
  }
  return {
    metadata: metadata.join(''),
    complete: end
  }
}

/**
 * Parses the metadata
 * @TODO need to test!!
 * @param metadata - string representing the metadata
 */
export function parseMetadata (metadata: string): ParsedFileMetadata {
  if (!isValidData(metadata)) {
    throw new Error('Invalid data')
  }
  // metadata.slice(0, -2)  // @WTF
  const preParse = metadata.split('\r\n')
  let filename!: string | undefined
  let contentType!: string | undefined
  const parsedName = preParse[0].match(nameRegExp)
  const name = parsedName !== null ? parsedName[0] : ''
  if (preParse[1]) {
    preParse[1] = preParse[1].replace('Content-Type: ', '')
    // preParse[1].slice(0, -2)  // @WTF
    const parsedFileName = preParse[0].match(filenameRegExp)
    filename = parsedFileName !== null ? parsedFileName[0] : undefined
    contentType = preParse[1]
  }
  return {
    name,
    filename,
    contentType,
  }
}

/**
 * Forms the parsed element. If it is a file then the filename and content type
 * would be not null
 * @param metadata - string representing the metadata
 * @param elData - element data (file or parameter)
 */
export function getParsedElement (metadata: string, elData: Buffer): ParsedElement {
  const parsed = parseMetadata(metadata)
  const content = elData.slice(metadata.length)
  return {
    ...parsed,
    value: parsed.filename ? content : content.toString()
  }
}

/**
 * Forms the element
 * @param elData - element to parse
 */
export function formElement (elData: Buffer): ParsedElement {
  const { metadata } = getMetaDataFromBuffer(elData)
  return getParsedElement(metadata, elData)
}

/**
 * Forms the array of parsed elements
 * @param elementsData - data of the elements to parse
 */
export function formElements (elementsData: Buffer[]): ParsedElement[] {
  const elements: ParsedElement[] = []
  elementsData.forEach(el => {
    elements.push(formElement(el))
  })
  return elements
}

/**
 * Extracts files and keys from raw formData
 * @param buffer - input file content
 */
export function extractKeyAndFiles (buffer: Buffer): {
  keys: FormDataKey[], files: FormDataFile[]
} {
  const filesData = formData(buffer)
  const elements = formElements(filesData)
  const files: FormDataFile[] = elements
    .filter(el => el.filename)
    .map(el => ({
      name: el.name,
      contentType: el.contentType || '',
      filename: el.filename || '',
      value: el.value instanceof Buffer ? el.value : Buffer.from(el.value)
    }))
  const keys: FormDataKey[] = elements
    .filter(el => !el.filename && typeof el.value === 'string')
    .map(el => ({
      name: el.name,
      value: el.value.toString()
    }))
  return {
    keys,
    files
  }
}
