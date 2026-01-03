import { parse } from 'next/dist/compiled/stacktrace-parser'
import type { StackFrame } from 'next/dist/compiled/stacktrace-parser'
import path from 'path'
import url from 'url'
import {
  decorateServerError,
  type ErrorSourceType,
} from '../../shared/lib/error-source'

/**
 * Normalize source URL by removing duplicate path segments.
 * This is a simplified version that doesn't depend on source-maps.ts
 * which uses Node.js 'module' that's not available in the browser.
 */
function normalizeSourceUrl(source: string): string {
  // Handle file:/ URL concatenation
  const lastFileUrlIndex = source.lastIndexOf('file:/')
  if (lastFileUrlIndex > 0) {
    let fileUrl = source.slice(lastFileUrlIndex)
    // Normalize file:/ to file:// (the canonical form)
    if (!fileUrl.startsWith('file://')) {
      fileUrl = 'file://' + fileUrl.slice(5)
    }
    return fileUrl
  }

  // Handle duplicate path segments (e.g., test/foo/test/foo/file.js)
  // Split path and look for repeated directory sequences
  const parts = source.split('/')
  for (let len = 1; len <= parts.length / 2; len++) {
    for (let i = 0; i <= parts.length - len * 2; i++) {
      // Check if parts[i:i+len] equals parts[i+len:i+len*2]
      let match = true
      for (let j = 0; j < len; j++) {
        if (parts[i + j] !== parts[i + len + j]) {
          match = false
          break
        }
      }
      if (match && parts[i] !== '..' && parts[i] !== '.' && parts[i] !== '') {
        // Remove the duplicate segment
        const newParts = [
          ...parts.slice(0, i + len),
          ...parts.slice(i + len * 2),
        ]
        return newParts.join('/')
      }
    }
  }

  return source
}

function getFilesystemFrame(frame: StackFrame): StackFrame {
  const f: StackFrame = { ...frame }

  if (typeof f.file === 'string') {
    // Normalize the source URL to remove duplicated path segments
    f.file = normalizeSourceUrl(f.file)

    if (
      // Posix:
      f.file.startsWith('/') ||
      // Win32:
      /^[a-z]:\\/i.test(f.file) ||
      // Win32 UNC:
      f.file.startsWith('\\\\')
    ) {
      f.file = `file://${f.file}`
    }
  }

  return f
}

/**
 * Convert a file path to a path relative to the current working directory.
 */
function toRelativePath(filePath: string): string {
  if (filePath.startsWith('file://')) {
    try {
      filePath = url.fileURLToPath(filePath)
    } catch {
      // Invalid file URL, use as-is
    }
  }

  if (path.isAbsolute(filePath)) {
    return path.relative(process.cwd(), filePath)
  }

  return filePath
}

export function getServerError(error: Error, type: ErrorSourceType): Error {
  if (error.name === 'TurbopackInternalError') {
    // If this is an internal Turbopack error we shouldn't show internal details
    // to the user. These are written to a log file instead.
    const turbopackInternalError = new Error(
      'An unexpected Turbopack error occurred. Please see the output of `next dev` for more details.'
    )
    decorateServerError(turbopackInternalError, type)
    return turbopackInternalError
  }

  let n: Error
  try {
    throw new Error(error.message)
  } catch (e) {
    n = e as Error
  }

  n.name = error.name
  try {
    n.stack = `${n.toString()}\n${parse(error.stack!)
      .map(getFilesystemFrame)
      .map((f) => {
        let str = `    at ${f.methodName}`
        if (f.file) {
          // Convert to relative path for cleaner output
          let loc = toRelativePath(f.file)
          if (f.lineNumber) {
            loc += `:${f.lineNumber}`
            if (f.column) {
              loc += `:${f.column}`
            }
          }
          str += ` (${loc})`
        }
        return str
      })
      .join('\n')}`
  } catch {
    n.stack = error.stack
  }

  decorateServerError(n, type)
  return n
}
