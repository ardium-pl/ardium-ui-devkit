import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isArray } from 'simple-bool';
import {
  FileSystemMethod,
  FileSystemRequestOptions,
  FileSystemSaveOptions,
} from './file-system.types';

const DEFAULT_SAVE_OPTIONS: FileSystemSaveOptions = {
  fileName: 'download',
  method: FileSystemMethod.PreferFileSystem,
};
const DEFAULT_REQUEST_OPTIONS: FileSystemRequestOptions = {
  method: FileSystemMethod.PreferFileSystem,
  multiple: false,
};

/**
 * Service for handling file system operations, including saving, uploading, and reading files.
 *
 * This service leverages the File System Access API when available and falls back to traditional
 * methods when necessary. It provides methods to check for API support, save files, request file uploads,
 * and read file contents.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API File System Access API}
 */
@Injectable({
  providedIn: 'root',
})
export class FileSystemService {
  private readonly _platformId = inject(PLATFORM_ID);
  /**
   * Checks if the File System Access API is supported for the specified method.
   *
   * @param method - The file system method to check ('showSaveFilePicker' or 'showOpenFilePicker').
   * @returns True if the specified method is supported, otherwise false.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API File System Access API}
   */
  isFileSystemAPISupported(
    method: 'showSaveFilePicker' | 'showOpenFilePicker',
  ): boolean {
    try {
      if (!isPlatformBrowser(this._platformId)) return false;
      // isn't in an iframe && browser version is high enough
      return window.self === window.top && method in window;
    } catch (err) {
      return false;
    }
  }

  //! saving files
  /**
   * Saves data as a file using the File System Access API or a fallback method.
   *
   * @param data - The data to be saved, either as a string or a Blob.
   * @param options - Options for saving the file, such as file name and save method.
   * @returns A promise that resolves to true if the file was saved successfully, otherwise false.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API File System Access API}
   */
  async saveAs(
    data: string | Blob,
    options: FileSystemSaveOptions = {},
  ): Promise<boolean> {
    if (!isPlatformBrowser(this._platformId)) return false;
    
    options = {
      ...DEFAULT_SAVE_OPTIONS,
      ...options,
    };
    // coerce string to blob if needed
    if (typeof data == 'string') {
      data = new Blob([data], {
        type: 'text/plain',
      });
    }
    // use the File System Access API if supported & preferred
    if (
      options.method == FileSystemMethod.PreferFileSystem &&
      this.isFileSystemAPISupported('showSaveFilePicker')
    ) {
      if (!options.types) options.types = [];

      // use the File System Access API
      try {
        const handle = await (window as any).showSaveFilePicker({
          id: options.directoryId,
          startIn: options.startDirectory,
          suggestedName: options.fileName,
          types: options.types,
        });

        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return true;
      } catch (err) {
        // fail silently if the user has simply canceled the dialog.
        const error = err as any;
        if (error.name !== 'AbortError') {
          console.error(error.name, error.message);
        }
        return false;
      }
    }
    // fallback if the File System Access API is not supported
    // or the user doesn't want to use it
    const blobURL = URL.createObjectURL(data);

    const a = document.createElement('a');
    a.href = blobURL;
    a.download = options.fileName!;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    //remove the element from the DOM
    return await new Promise<boolean>((resolve) =>
      setTimeout(() => {
        URL.revokeObjectURL(blobURL);
        document.body.removeChild(a);
        resolve(true);
      }, 1000),
    );
  }

  //! opening files
  /**
   * Requests a file upload using the File System Access API or a fallback method.
   *
   * @param options - Options for requesting the file upload, such as accepted file types and method.
   * @returns A promise that resolves to the selected file or files, or null if the operation was canceled.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API File System Access API}
   */
  async requestFileUpload(
    options: FileSystemRequestOptions = {},
  ): Promise<File | File[] | null> {
    if (!isPlatformBrowser(this._platformId)) return null;

    options = {
      ...DEFAULT_REQUEST_OPTIONS,
      ...options,
    };
    // use the File System Access API if supported & preferred
    if (
      options.method == 'preferFileSystem' &&
      this.isFileSystemAPISupported('showOpenFilePicker')
    ) {
      try {
        // coerce the options.accept into a valid options.types object
        if (options.accept) {
          if (typeof options.accept == 'string') {
            options.accept = options.accept.split(',');
          }
          for (const accept of options.accept) {
            if (!accept.match(/^\.[a-z0-9]+$/)) {
              throw new Error(
                `DKT-FT0010: "accept" property in FileSystemService must be a list of valid file extensions. Value "${accept}" is not a valid extension.`,
              );
            }
          }

          if (!options.types) options.types = [];

          const accept = {
            'application/octet-stream': options.accept,
          };
          options.types.push({ accept: accept });
        }

        // open the dialog box
        const handles = await (window as any).showOpenFilePicker({
          id: options.directoryId,
          startIn: options.startDirectory,
          types: options.types,
          multiple: options.multiple,
        });
        const fileArray = (await Promise.all(
          handles.map(async (handle: any) => {
            const file = await handle.getFile();
            file.handle = handle;
            return file as File;
          }),
        )) as File[];
        if (!options.multiple) {
          return fileArray[0];
        }
        return fileArray;
      } catch (err) {
        // fail silently if the user has simply canceled the dialog.
        const error = err as any;
        if (error.name !== 'AbortError') {
          console.error(error.name, error.message);
        }
        return null;
      }
    }
    // fallback if the File System Access API is not supported
    // or the user doesn't want to use it

    // coerce options.accept into a string
    if (isArray(options.accept)) {
      options.accept = options.accept.join(',');
    } else {
      options.accept = options.accept ?? '*';
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    input.multiple = options.multiple ?? false;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();

    const fileArray = await new Promise<File[] | null>((resolve) => {
      input.onchange = () => {
        resolve(
          input.files && input.files.length > 0
            ? Array.from(input.files)
            : null,
        );
        document.body.removeChild(input);
      };
    });
    if (options.multiple || !fileArray) {
      return fileArray;
    }
    return fileArray[0];
  }

  //! reading file content
  /**
   * Reads the content of a file as a string with optional encoding.
   *
   * @param file - The file to read.
   * @param readAs - The method to read the file (in this case - "text").
   * @param encoding - The encoding to use when reading the file as text. Defaults to UTF-8.
   * @returns A promise that resolves to the file content as a string or null.
   */
  async readFile(
    file: File,
    readAs?: 'text',
    encoding?: string,
  ): Promise<string | null>;

  /**
   * Reads the content of a file as an ArrayBuffer.
   *
   * @param file - The file to read.
   * @param readAs - The method to read the file (in this case - "binary").
   * @returns A promise that resolves to the file content as an ArrayBuffer or null.
   */
  async readFile(file: File, readAs?: 'binary'): Promise<ArrayBuffer | null>;

  /**
   * Reads the content of a file.
   *
   * @param file - The file to read.
   * @param readAs - The method to read the file ("text" or "binary").
   * @param encoding - The encoding to use when reading the file as text (default is 'UTF-8').
   * @returns A promise that resolves to the file content as a string, ArrayBuffer, or null.
   */
  async readFile(
    file: File,
    readAs?: 'text' | 'binary',
    encoding?: string,
  ): Promise<string | ArrayBuffer | null>;

  async readFile(
    file: File,
    readAs: 'text' | 'binary' = 'text',
    encoding: string = 'UTF-8',
  ): Promise<string | ArrayBuffer | null> {
    if (readAs == 'text') {
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.readAsText(file, encoding);
        reader.onload = function (e) {
          resolve(e.target!.result as string | null);
        };
      });
    }
    return new Promise<ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = function (e) {
        resolve(e.target!.result as ArrayBuffer | null);
      };
    });
  }
}
