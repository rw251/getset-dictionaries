const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');

const relationships = {};
const concepts = {};
const activeConcepts = {};
const types = { FULL: 'Full', SNAPSHOT: 'Snapshot' };

const run = (type = types.SNAPSHOT) => {
  console.time('Elapsed');
  // These are "inferred" relationships
  const inputRelationshipsUK = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_UKClinicalRF2_Production_20180711T000001Z', type, 'Terminology', `sct2_Relationship_${type}_GB1000000_20180711.txt`));
  const inputRelationships = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_InternationalRF2_PRODUCTION_20180131T120000Z', type, 'Terminology', `sct2_Relationship_${type}_INT_20180131.txt`));

  // These are "stated" relationships
  const inputStatedRelationshipsUK = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_UKClinicalRF2_Production_20180711T000001Z', type, 'Terminology', `sct2_StatedRelationship_${type}_GB1000000_20180711.txt`));
  const inputStatedRelationships = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_InternationalRF2_PRODUCTION_20180131T120000Z', type, 'Terminology', `sct2_StatedRelationship_${type}_INT_20180131.txt`));

  // Descriptions
  const inputDescriptionsUK = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_UKClinicalRF2_Production_20180711T000001Z', type, 'Terminology', `sct2_Description_${type}-en-GB_GB1000000_20180711.txt`));
  const inputDescriptions = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_InternationalRF2_PRODUCTION_20180131T120000Z', type, 'Terminology', `sct2_Description_${type}-en_INT_20180131.txt`));

   // Concepts
  const inputConceptsUK = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_UKClinicalRF2_Production_20180711T000001Z', type, 'Terminology', `sct2_Concept_${type}_GB1000000_20180711.txt`));
  const inputConcepts = fs.createReadStream(path.join('C:', 'Users', 'MDEHSRW9', 'Dropbox (The University of Manchester)', 'Me', 'Clinical code terminologies', 'uk_sct2cl_25.0.2_20180711000001', 'SnomedCT_InternationalRF2_PRODUCTION_20180131T120000Z', type, 'Terminology', `sct2_Concept_${type}_INT_20180131.txt`));

  const outputStream = fs.createWriteStream(path.join('terminologies', 'SNOMED CT', 'data-processed', 'uk.snomed.dict.txt'));
  const readable = new Stream.Readable({
    read(size) {
      return !!size;
    },
  });

  readable.pipe(outputStream);

  outputStream.on('finish', () => {
    console.timeEnd('Elapsed');
  });

  const onRelationshipLine = (line) => {
    const elems = line.split('\t');
    // if (['3844012023', '18020020', '18021024', '4570414021'].indexOf(elems[0]) > -1) console.log(line);
    if (elems[7] === '116680003' && elems[2] === '1') {
      if (elems[4] === '105213004') console.log('R', elems.join('|'));
      if (!relationships[elems[4]]) {
        relationships[elems[4]] = [elems[5]];
      } else {
        relationships[elems[4]].push(elems[5]);
      }
      // if (elems[0] === '999004611000000126') console.log(line);
      // if (!relationships[elems[0]]) {
      //   relationships[elems[0]] = {};
      //   relationships[elems[0]][elems[4]] = { destination: elems[5], date: elems[1], active: elems[2] };
      // } else if (!relationships[elems[0]][elems[4]] || relationships[elems[0]][elems[4]].destination !== elems[5]) {
      //   console.log(line);
      //   console.log('WHY!');
      //   process.exit(1);
      // } else if ((elems[1] === relationships[elems[0]][elems[4]].date && elems[2] === '1') || elems[1] > relationships[elems[0]][elems[4]].date) {
      //   relationships[elems[0]][elems[4]] = { destination: elems[5], date: elems[1], active: elems[2] };
      // }
      // if (!relationships[elems[4]]) {
      //   relationships[elems[4]] = {};
      // }
      // if (!relationships[elems[4]][elems[5]]) {
      //   relationships[elems[4]][elems[5]] = { date: elems[1], active: elems[2] };
      // } else if ((elems[1] === relationships[elems[4]][elems[5]].date && elems[2] === '1') || elems[1] > relationships[elems[4]][elems[5]].date) {
      //   relationships[elems[4]][elems[5]] = { date: elems[1], active: elems[2] };
      // }
      if (elems[4] === '105213004') console.log('R', relationships[elems[4]]);
    }
  };

  let done = 0;

  const doMainProcessing = () => {
    Object.keys(concepts).forEach((conceptId) => {
      if (conceptId === '105213004') {
        console.log(activeConcepts[conceptId]);
        console.log(relationships[conceptId]);
      }
      if (activeConcepts[conceptId].active === '0') return;
      const already = {};
      concepts[conceptId].forEach((description) => {
        if (!relationships[conceptId]) {
          if (!already[`${conceptId}\t${description}\t?\n`]) {
            already[`${conceptId}\t${description}\t?\n`] = true;
            readable.push(`${conceptId}\t${description}\t?\n`);
          }
        } else {
          // Object.keys(relationships[conceptId]).forEach((parentId) => {
          relationships[conceptId].forEach((parentId) => {
            // if (relationships[conceptId][parentId].active === '0') return;
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
      console.log('All files loaded.');
      try {
        doMainProcessing();
      } catch (err) {
        console.log('err');
        console.log(err);
      }
      console.log('Processing of records complete.');
    }
  };

  const onRelationshipEnd = () => {
    console.log(`Relationships loaded: ${Object.keys(relationships).length}`);
    areWeDone();
  };

  const rlRelationshipsUK = readline.createInterface({
    input: inputRelationshipsUK,
  });
  rlRelationshipsUK
    .on('line', onRelationshipLine)
    .on('close', onRelationshipEnd);

  const rlRelationships = readline.createInterface({
    input: inputRelationships,
  });
  rlRelationships
    .on('line', onRelationshipLine)
    .on('close', onRelationshipEnd);

  const rlStatedRelationshipsUK = readline.createInterface({
    input: inputStatedRelationshipsUK,
  });

  rlStatedRelationshipsUK
    .on('line', onRelationshipLine)
    .on('close', onRelationshipEnd);

  const rlStatedRelationships = readline.createInterface({
    input: inputStatedRelationships,
  });

  rlStatedRelationships
      .on('line', onRelationshipLine)
      .on('close', onRelationshipEnd);

  const onDescriptionLine = (line) => {
    const elems = line.split('\t');
    if (elems[2] === '1') { // active
      if (!concepts[elems[4]]) {
        concepts[elems[4]] = [elems[7]];
      } else {
        concepts[elems[4]].push(elems[7]);
      }
    }
  };

  const onDescriptionEnd = () => {
    console.log(`Concepts loaded: ${Object.keys(concepts).length}`);
    areWeDone();
  };

  const rlDescriptionsUK = readline.createInterface({
    input: inputDescriptionsUK,
  });

  rlDescriptionsUK
      .on('line', onDescriptionLine)
      .on('close', onDescriptionEnd);

  const rlDescriptions = readline.createInterface({
    input: inputDescriptions,
  });

  rlDescriptions
      .on('line', onDescriptionLine)
      .on('close', onDescriptionEnd);


  const onConceptLine = (line) => {
    const elems = line.split('\t');

    if (type === types.FULL) {
      if (!activeConcepts[elems[0]]) {
        activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
      } else if ((elems[1] === activeConcepts[elems[0]].date && elems[2] === '1') || elems[1] > activeConcepts[elems[0]].date) {
        activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
      }
    } else if (type === types.SNAPSHOT) {
      activeConcepts[elems[0]] = { date: elems[1], active: elems[2] };
    } else {
      console.error(`unknown type${type}`);
      process.exit(1);
    }


    if (elems[0] === '105213004') {
      // console.log('C', line);
      // console.log('C', activeConcepts[elems[0]]);
    }
  };

  const onConceptEnd = () => {
    console.log(`Active concepts loaded: ${Object.keys(activeConcepts).length}`);
    areWeDone();
  };

  const rlConceptsUK = readline.createInterface({
    input: inputConceptsUK,
  });

  rlConceptsUK
      .on('line', onConceptLine)
      .on('close', onConceptEnd);

  const rlConcepts = readline.createInterface({
    input: inputConcepts,
  });

  rlConcepts
      .on('line', onConceptLine)
      .on('close', onConceptEnd);
};

module.exports = { run };
