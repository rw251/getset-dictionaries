const fs = require('fs');
const { join } = require('path');
const parentLogger = require('../../../src/logger');
const logger = parentLogger.child({ terminology: 'CTV3' });

const getFileInputLocation = (directory, version) => {
  const filePath = join(directory, version, 'CTV3.txt');
  if (!fs.existsSync(filePath)) {
    logger.error(
      'The file',
      filePath,
      'does not exist. Please download the CTV3 dictionary from somewhere.'
    );
    process.exit(1);
  }
  return filePath;
};

const getFileHierarchyInputLocation = (directory, version) => {
  const filePath = join(directory, version, 'CTV3HIER.txt');
  if (!fs.existsSync(filePath)) {
    logger.error(
      'The file',
      filePath,
      'does not exist. Please download the CTV3 dictionary from somewhere.'
    );
    process.exit(1);
  }
  return filePath;
};

const run = (directory, version) =>
  new Promise((resolve) => {
    const inputLocation = getFileInputLocation(directory, version);
    const inputHierarchyLocation = getFileHierarchyInputLocation(directory, version);

    const ctv3Dic = {};
    fs.readFileSync(inputLocation, 'utf8')
      .split('\n')
      .forEach((row) => {
        if (row.trim().length < 5) return;
        const [ctv3id, , , , t30, t60, t198] = row.replace(/\r/g, '').replace(/"/g, '').split('\t');
        if (t30.trim() === '') {
          logger.warn(`${ctv3id} doesn't seem to have any description.`);
        } else if (t30.trim().toLowerCase() === 'retired ctv3 code; no term') {
          return;
        }
        ctv3Dic[ctv3id] = { ctv3id, t30, t60, t198, parents: [] };
      });
    fs.readFileSync(inputHierarchyLocation, 'utf8')
      .split('\n')
      .forEach((row) => {
        if (row.trim().length < 5) return;
        const [childId, parentId] = row.replace(/\r/g, '').replace(/"/g, '').split('\t');
        if (!ctv3Dic[childId]) {
          logger.warn(
            `${childId} (with parent of ${parentId}) is not found in the main CTV3 file.`
          );
        } else {
          ctv3Dic[childId].parents.push(parentId);
        }
      });

    const output = [];
    Object.keys(ctv3Dic).forEach((key) => {
      if (ctv3Dic[key].parents.length === 0) {
        if (key === '.....') return;
        logger.warn(`${key} doesn't have any parents.`);
      } else {
        ctv3Dic[key].parents.forEach((parentId) => {
          if (ctv3Dic[key].t30 && ctv3Dic[key].t30.trim().length > 0) {
            output.push(`${key}\t${ctv3Dic[key].t30}\t${parentId}`);
          }
          if (ctv3Dic[key].t60 && ctv3Dic[key].t60.trim().length > 0) {
            output.push(`${key}\t${ctv3Dic[key].t60}\t${parentId}`);
          }
          if (ctv3Dic[key].t198 && ctv3Dic[key].t198.trim().length > 0) {
            output.push(`${key}\t${ctv3Dic[key].t198}\t${parentId}`);
          }
        });
      }
    });

    fs.writeFileSync(
      join('terminologies', 'CTV3', 'data-processed', version, 'dict.txt'),
      output.join('\n')
    );
    resolve();
  });

module.exports = { run };
