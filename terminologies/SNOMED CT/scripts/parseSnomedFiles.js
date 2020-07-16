const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');
const parentLogger = require('../../../src/logger');
const logger = parentLogger.child({ terminology: 'SNOMED' });

let relationships = {};
let concepts = {};
let activeConcepts = {};
const types = { FULL: 'Full', SNAPSHOT: 'Snapshot' };

const getSnomedHighLevelVersions = (directory, version, type) => {
  const directories = fs.readdirSync(path.join(directory, version));
  const UK = directories.filter((x) => x.indexOf('SnomedCT_UK') === 0);
  const International = directories.filter((x) => x.indexOf('SnomedCT_International') === 0);
  if (UK.length !== 1 || International.length !== 1) {
    logger.error(
      { version },
      'The directory',
      directory,
      'and version',
      version,
      'does not conform to expectations'
    );
    process.exit(1);
  }
  const UKfiles = fs.readdirSync(path.join(directory, version, UK[0], type, 'Terminology'));
  const Intfiles = fs.readdirSync(
    path.join(directory, version, International[0], type, 'Terminology')
  );
  const UKrel = UKfiles.filter((x) => x.indexOf('sct2_Relationship_') === 0);
  const Intrel = Intfiles.filter((x) => x.indexOf('sct2_Relationship_') === 0);
  const UKstatedRel = UKfiles.filter((x) => x.indexOf('sct2_StatedRelationship_') === 0);
  const IntstatedRel = Intfiles.filter((x) => x.indexOf('sct2_StatedRelationship_') === 0);
  const UKdesc = UKfiles.filter((x) => x.indexOf('sct2_Description_') === 0);
  const Intdesc = Intfiles.filter((x) => x.indexOf('sct2_Description_') === 0);
  const UKconcept = UKfiles.filter((x) => x.indexOf('sct2_Concept_') === 0);
  const Intconcept = Intfiles.filter((x) => x.indexOf('sct2_Concept_') === 0);
  if (UKrel.length * UKstatedRel.length * UKdesc.length * UKconcept.length !== 1) {
    logger.error(
      { version },
      'The directory',
      path.join(directory, version, UK[0], type, 'Terminology'),
      'does not conform to expectations'
    );
    process.exit(1);
  }
  if (Intrel.length * IntstatedRel.length * Intdesc.length * Intconcept.length !== 1) {
    logger.error(
      { version },
      'The directory',
      path.join(directory, version, International[0], type, 'Terminology'),
      'does not conform to expectations'
    );
    process.exit(1);
  }
  return {
    UK: {
      root: UK[0],
      rel: UKrel[0],
      statedRel: UKstatedRel[0],
      desc: UKdesc[0],
      concept: UKconcept[0],
    },
    International: {
      root: International[0],
      rel: Intrel[0],
      statedRel: IntstatedRel[0],
      desc: Intdesc[0],
      concept: Intconcept[0],
    },
  };
};

const run = (directory, version, type = types.SNAPSHOT) =>
  new Promise((resolve, reject) => {
    relationships = {};
    concepts = {};
    activeConcepts = {};

    const { UK, International } = getSnomedHighLevelVersions(directory, version, type);

    // These are "inferred" relationships
    const inputRelationshipsUK = fs.createReadStream(
      path.join(directory, version, UK.root, type, 'Terminology', UK.rel)
    );
    const inputRelationships = fs.createReadStream(
      path.join(directory, version, International.root, type, 'Terminology', International.rel)
    );

    // These are "stated" relationships
    const inputStatedRelationshipsUK = fs.createReadStream(
      path.join(directory, version, UK.root, type, 'Terminology', UK.statedRel)
    );
    const inputStatedRelationships = fs.createReadStream(
      path.join(
        directory,
        version,
        International.root,
        type,
        'Terminology',
        International.statedRel
      )
    );

    // Descriptions
    const inputDescriptionsUK = fs.createReadStream(
      path.join(directory, version, UK.root, type, 'Terminology', UK.desc)
    );
    const inputDescriptions = fs.createReadStream(
      path.join(directory, version, International.root, type, 'Terminology', International.desc)
    );

    // Concepts
    const inputConceptsUK = fs.createReadStream(
      path.join(directory, version, UK.root, type, 'Terminology', UK.concept)
    );
    const inputConcepts = fs.createReadStream(
      path.join(directory, version, International.root, type, 'Terminology', International.concept)
    );

    const outputStream = fs.createWriteStream(
      path.join('terminologies', 'SNOMED CT', 'data-processed', version, 'dict.txt')
    );
    const readable = new Stream.Readable({
      read(size) {
        return !!size;
      },
    });

    readable.pipe(outputStream);

    outputStream.on('finish', () => {
      logger.info({ version }, 'Output written. All Done!');
      return resolve();
    });

    const onRelationshipLine = (line) => {
      const elems = line.split('\t');
      if (elems[7] === '116680003' && elems[2] === '1') {
        if (!relationships[elems[4]]) {
          relationships[elems[4]] = [elems[5]];
        } else {
          relationships[elems[4]].push(elems[5]);
        }
      }
    };

    let done = 0;

    const doMainProcessing = () => {
      Object.keys(concepts).forEach((conceptId) => {
        if (activeConcepts[conceptId].active === '0') return;
        const already = {};
        concepts[conceptId].forEach((description) => {
          if (!relationships[conceptId]) {
            if (!already[`${conceptId}\t${description}\t?\n`]) {
              already[`${conceptId}\t${description}\t?\n`] = true;
              readable.push(`${conceptId}\t${description}\t?\n`);
            }
          } else {
            relationships[conceptId].forEach((parentId) => {
              if (!already[`${conceptId}\t${description}\t${parentId}\n`]) {
                already[`${conceptId}\t${description}\t${parentId}\n`] = true;
                readable.push(`${conceptId}\t${description}\t${parentId}\n`);
              }
            });
          }
        });
      });
      readable.push(null);
    };

    const areWeDone = () => {
      done += 1;
      if (done === 8) {
        logger.info({ version }, 'All files loaded into memory. Starting the main processing...');
        try {
          doMainProcessing();
        } catch (err) {
          logger.info({ version }, 'err');
          logger.info({ version }, err);
        }
        logger.info({ version }, 'Processing of records complete. Finishing writing output...');
      }
    };

    const onRelationshipEnd = () => {
      logger.info({ version }, `Relationships loaded: ${Object.keys(relationships).length}`);
      areWeDone();
    };

    const rlRelationshipsUK = readline.createInterface({
      input: inputRelationshipsUK,
    });
    rlRelationshipsUK.on('line', onRelationshipLine).on('close', onRelationshipEnd);

    const rlRelationships = readline.createInterface({
      input: inputRelationships,
    });
    rlRelationships.on('line', onRelationshipLine).on('close', onRelationshipEnd);

    const rlStatedRelationshipsUK = readline.createInterface({
      input: inputStatedRelationshipsUK,
    });

    rlStatedRelationshipsUK.on('line', onRelationshipLine).on('close', onRelationshipEnd);

    const rlStatedRelationships = readline.createInterface({
      input: inputStatedRelationships,
    });

    rlStatedRelationships.on('line', onRelationshipLine).on('close', onRelationshipEnd);

    const onDescriptionLine = (line) => {
      const elems = line.split('\t');
      if (elems[2] === '1') {
        // active
        if (!concepts[elems[4]]) {
          concepts[elems[4]] = [elems[7]];
        } else {
          concepts[elems[4]].push(elems[7]);
        }
      }
    };

    const onDescriptionEnd = () => {
      logger.info({ version }, `Concepts loaded: ${Object.keys(concepts).length}`);
      areWeDone();
    };

    const rlDescriptionsUK = readline.createInterface({
      input: inputDescriptionsUK,
    });

    rlDescriptionsUK.on('line', onDescriptionLine).on('close', onDescriptionEnd);

    const rlDescriptions = readline.createInterface({
      input: inputDescriptions,
    });

    rlDescriptions.on('line', onDescriptionLine).on('close', onDescriptionEnd);

    const onConceptLine = (line) => {
      const elems = line.split('\t');

      if (type === types.FULL) {
        if (!activeConcepts[elems[0]]) {
          activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
        } else if (
          (elems[1] === activeConcepts[elems[0]].date && elems[2] === '1') ||
          elems[1] > activeConcepts[elems[0]].date
        ) {
          activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
        }
      } else if (type === types.SNAPSHOT) {
        activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
      } else {
        logger.error({ version }, `unknown type${type}`);
        return reject();
      }
    };

    const onConceptEnd = () => {
      logger.info({ version }, `Active concepts loaded: ${Object.keys(activeConcepts).length}`);
      areWeDone();
    };

    const rlConceptsUK = readline.createInterface({
      input: inputConceptsUK,
    });

    rlConceptsUK.on('line', onConceptLine).on('close', onConceptEnd);

    const rlConcepts = readline.createInterface({
      input: inputConcepts,
    });

    rlConcepts.on('line', onConceptLine).on('close', onConceptEnd);
  });

module.exports = { run };
