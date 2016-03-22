export const HOTPUSH_TYPE = {
  'MERGE': 'merge',
  'REPLACE': 'replace'
}

export const HOTPUSH_CHECK_TYPE = {
  'VERSION': 'version',
  'TIMESTAMP': 'timestamp'
}

export const PROGRESS_STATE = {
  0: 'STOPPED',
  1: 'DOWNLOADING',
  2: 'EXTRACTING',
  3: 'COMPLETE'
}

export const ERROR_STATE = {
  1: 'INVALID_URL_ERR',
  2: 'CONNECTION_ERR',
  3: 'UNZIP_ERR'
}

export const UPDATE = {
  NOT_FOUND: 'NOT_FOUND',
  FOUND: 'FOUND'
}
