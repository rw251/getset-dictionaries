# Dictionary processing for GetSet

Everything you need to know to process a clinical code dictionary and then populate a mongo database to act as the backend for GetSet. Currently the system is configured for Read v2, EMIS and SNOMED.

## Quick start

This is if you want to process a terminology **_that already has_** a directory under `./terminologies`. There are 3 main stages:

1. Conversion

   Converting the terminology from the raw format as downloaded from the terminology provider, into the 3 column format required for the processing stage.

2. Processing

   Take the 3 column files and process into the format required for the mongo db. The output is a JSON file which can then be uploaded to the mongo db.

3. Uploading

   Take the JSON files and upload to mongo. This can actually be split into two parts: uploading and adding the indexes.

### Conversion

1. Install all node dependencies
   ```
   npm i
   ```
2. Copy the `.env.example` file to `.env` and update it to reflect your environment. At the moment the only environment variables are the location of the mongo db you wish to update (`GETSET_MONGO_URL`), and locations of the raw clinical dictionary data (e.g. `SNOMED_DIRECTORY`).
3. Download the data files for the terminologies you're interested in. For the existing terminologies they are found at:
   - EMIS: proprietary system - not publically available
   - SNOMED: https://isd.digital.nhs.uk/trud3/user/authenticated/group/0/pack/26/subpack/101/releases
   - READ v2: Discontinued in 2016. Until recently was still available from https://isd.digital.nhs.uk/trud3, but no longer appears to be there. Please contact NHS digital to gain access.
4. Extract the files and folders into the relevant directory as set in the `.env` file.
   - READ v2: Directly under the `READ_V2_DIRECTORY` should be one directory per release. Within each release directory there should be a `codes` directory for the non-drug codes and a `drugs` directory for the drug codes. Therefore the directories will look like this:
     ```js
     READ_V2_DIRECTORY // Set in the .env file
     ├─ v20160401 // One sub-directory for each release to process
     │  ├─ codes // For the non-drug Read codes
     │  │  ├─ Document
     │  │  ├─ V2
     │  │  └─ Vaf
     │  └─ drugs // For the drug Read codes
     │     ├─ Derived
     │     ├─ Documents
     │     └─ Source
     └─ v20151001
       ├─ codes
       └─ drugs
     ```
   - SNOMED: Directly under the `SNOMED_DIRECTORY` should be one directory pre release. Therefore the directories will look like this:
     ```js
     SNOMED_DIRECTORY // Set in the .env file
     ├─ uk_sct2cl_25.0.2_20180711000001 // One sub-directory for each release to process
     │  ├─ SnomedCT_InternationalRF2_PRODUCTION_20180131T120000Z
     │  └─ SnomedCT_UKClinicalRF2_Production_20180711T000001Z
     └─ uk_sct2cl_29.3.0_20200610000001
        ├─ SnomedCT_InternationalRF2_PRODUCTION_20180731T120000Z
        └─ SnomedCT_UKClinicalRF2_PRODUCTION_20200610T000001Z
     ```
5. To convert the raw data files into ones that can be processed by the next stage execute:
   ```
   npm start
   ```
   and select `Take raw terminology data and process it to the 3 column format (id,description,parent)`
6. Follow on-screen instructions
7. Output files of the form `*.dict.txt` will be written into the `data-processed` directories within each terminology folder.

### Processing

1. Do the conversion as above for at least one terminology
2. Execute:
   ```
   npm start
   ```
   and select `Process 3 column format data into JSON ready to upload to mongo`
3. Follow on-screen instructions
4. Output `json` files will be written into the `./cache/[terminology]/` directories

### Uploading

1. Do the conversion and processing as above for at least one terminology
2. Execute:
   ```
   npm start
   ```
   and select `Upload JSON to mongo and add indexes`
3. Follow on-screen instructions
4. Alternatively you can perform the uploading and the adding indexes separately by selecting different options when prompted.

# More detail

## Processing the terminology

The goal is to produce a **tab separated** output file with **no header row** and the following columns: `Code`, `Description`, `Parent code`.

Notes:

- If a code has multiple definitions or multiple parents then a new line is required for each. E.g.

```
104001	Excision of lesion of patella	68471001
104001	Excision of lesion of patella	373196008
104001	Local excision of lesion or tissue of patella	68471001
104001	Local excision of lesion or tissue of patella	373196008
```

- Read code v2 is special. Each code has up to three definitions (short, medium, and long), but then also synonymous definitions which have different term codes. E.g. `J4...` has a short and a medium definition with the default term code of `00`, but also 3 synonyms with term codes `11`, `12`, and `13` as shown here:

```
J4...00	Noninfective enteritis/colitis	J....
J4...00	Noninfective enteritis and colitis	J....
J4...11	Colitis - noninfective	J....
J4...12	Inflammatory bowel disease	J....
J4...13	Noninfective diarrhoea	J....
```

### Steps (for a new terminology)

For a terminology called MyTerm you would do the following:

1. Create folders:

```
./terminologies/MyTerm
./terminologies/MyTerm/data-processed
./terminologies/MyTerm/scripts
```

2. Obtain text files for MyTerm and add an entry to the `.env` file with the location of the terminology. E.g. just like the `SNOMED_DIRECTORY` variable
3. Create scripts in the `scripts` directory that take the input files, process them into the correct format, and save them to the `data-processed` directory. **NB: the output filename(s) must end with `.dict.txt`.**
4. Create a file `./terminologies/MyTerm/process.js` which when executed calls all the scripts in the `scripts` directory.

## Loading the terminology

Currently the best approach is to store each version of a terminology in a collection called `codes-${name}-${version}` with an object structure as follows:

```js
{
  _id: String, // The clinical code
  t: String, // A | separated list of synonymous definitions
  a: { type: [String] }, // Ancestors
  p: { type: [String] }, // Immediate parents
  w: { type: [String] }, // Each word in the descriptions
}
```

It's also useful to have a collection called `words-${name}-${version}` containing every word in the terminology with the following structure:

```js
{
  _id: String, // The word
  n: Number, // The number of times this word occurs
}
```

The search is then done by using whole words. Wildcards are also allowed by converting the query to a regex expression.
