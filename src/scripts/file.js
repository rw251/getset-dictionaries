// Responsible for determining which files are in various
// places. E.g. which cached json files are ready to upload.
const fs = require('fs');
const { join } = require('path');
const { Code, Word } = require('./model');

const CACHED_DIR = join(__dirname, '..', '..', 'cache');
const CACHED_TUPLE_DIR = join(__dirname, '..', '..', 'cachedTuples');
const TERMINOLOGY_DIR = join(__dirname, '..', '..', 'terminologies');

/**
 * Finds all subdirectories in a directory.
 * @param {string} directory The path of the directory.
 * @returns {Array} List of subdir names.
 */
const getSubDirectories = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

/**
 * Finds all files in a directory. Excludes any .gitignore files.
 * @param {string} directory The path of the directory.
 * @returns {Array} List of filenames.
 */
const getFiles = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((filename) => filename !== '.gitignore');

/**
 * Ensures the output directory is present
 * @param {string} terminology The terminology to create a directory for
 */
const createOutputCacheDirIfNotExists = (terminology) => {
  const dirPath = join(CACHED_DIR, terminology);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

/**
 * Populate the terminology/version combos that exist in the
 * data-processed directories
 */
const getTermVersFromProcessedData = () => {
  const terminologyVersions = [];
  getSubDirectories(TERMINOLOGY_DIR).map((terminology) => {
    createOutputCacheDirIfNotExists(terminology);
    const versions = getSubDirectories(join(TERMINOLOGY_DIR, terminology, 'data-processed'));
    versions.map((version) => {
      terminologyVersions.push({
        id: terminology,
        version,
      });
    });
  });
  return terminologyVersions;
};

/**
 * Populate the cached terminology/version combos that exist
 * in the cache directory
 */
const getTermVersFromCache = () => {
  const cachedTuplifiedTerminologies = [];
  getSubDirectories(CACHED_DIR).map((terminology) => {
    const files = getFiles(join(CACHED_DIR, terminology));
    const versionObject = {};
    files.forEach((file) => {
      const isWordFile = file.indexOf('words_') === 0;
      const version = isWordFile
        ? file.substr(6, file.length - 11)
        : file.substr(0, file.length - 5);
      if (!versionObject[version]) {
        versionObject[version] = { hasWordFile: isWordFile, hasOtherFile: !isWordFile };
      } else if (
        (isWordFile && versionObject[version].hasOtherFile) ||
        (!isWordFile && versionObject[version].hasWordFile)
      ) {
        cachedTuplifiedTerminologies.push({
          id: terminology,
          version,
          codeCollection: Code(terminology, version),
          wordCollection: Word(terminology, version),
        });
      }
    });
  });
  return cachedTuplifiedTerminologies;
};

/**
 * Populate the cached terminology/version combos that exist
 * in the tuplified cache directory
 */
const getTuplesFromCache = () =>
  getFiles(CACHED_TUPLE_DIR).map((file) => {
    const [terminology, version, tuple] = file.split('-');
    return { id: terminology, version, tuple };
  });

module.exports = {
  getTermVersFromProcessedData,
  getTermVersFromCache,
  getTuplesFromCache,
};
