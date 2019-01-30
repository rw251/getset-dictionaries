# DISREGARD THE BELOW NEEDS REWRITING - CURRENT BEST IS IN 5


# Dictionary processing for GetSet

Everything you need to know to process a clinical code dictionary and then populate a mongo database to act as the backend for GetSet.

## Quick start

**NB Ensure the `.env` file contains the correct mongo db url.**

**If there are issues with a remote mongo timing out or getting ECONNRESET errors then load to local and then upload with mongodump/mongorestore**

```
mongodump -h localhost -d getset -o tempDirectory
mongorestore -h xxxx -u xxxx -p xxxx -d getset --drop tempDirectory/getset/
```

**Processing existing terminology**

For a terminology called MyTerm that has already been processed 
```
node --max_old_space_size=4096 terminologies/MyTerm/process.js | node_modules/.bin/pino
```

**Loading existing cached data files to mongo**

Edit scripts/best/config.js and set
```
const OVERWRITE_FILE = false;
```
Then execute:
```
node --max_old_space_size=4096 scripts/best/main.js | node_modules/.bin/pino
```

**Process data files and load to mongo**

Edit scripts/best/config.js and set
```
const OVERWRITE_FILE = true;
```
Then execute:
```
node --max_old_space_size=4096 scripts/best/main.js | node_modules/.bin/pino
```

# More detail

## Processing the terminology

The goal is to produce a **tab separated** output file with **no header row** and the following columns: `Code`, `Description`, `Parent code`.

Notes:

* If a code has multiple definitions or multiple parents then a new line is required for each. E.g.

```
104001	Excision of lesion of patella	68471001
104001	Excision of lesion of patella	373196008
104001	Local excision of lesion or tissue of patella	68471001
104001	Local excision of lesion or tissue of patella	373196008
```

* Read code v2 is special. Each code has up to three definitions (short, medium, and long), but then also synonymous definitions which have different term codes. E.g. `J4...` has a short and a medium definition with the default term code of `00`, but also 3 synonyms with term codes `11`, `12`, and `13` as shown here:
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
./terminologies/MyTerm/data-input
./terminologies/MyTerm/data-processed
./terminologies/MyTerm/scripts
```
2. Obtain text files for MyTerm and place in the `data-input` directory
3. Create scripts in the `scripts` directory that take the input files, process them into the correct format, and save them to the `data-processed` directory. **NB: the output filename(s) must end with `.dict.txt`.**
4. Create a file `./terminologies/MyTerm/process.js` which when executed calls all the scripts in the `scripts` directory.
5. Execute:
```
node --max_old_space_size=4096 terminologies/MyTerm/process.js | node_modules/.bin/pino
```

### Steps (for an exiting terminology)

Assuming you've left it in a good state just run:
```
node --max_old_space_size=4096 terminologies/MyTerm/process.js | node_modules/.bin/pino
```

## Loading the terminology

Currently the best approach is to store a terminology in a collection called `codes` with an object structure as follows:

```
{
  _id: {
    d: String, // The clinical code dictionary (EMIS/Readv2/SNOMED)
    c: String, // The clinical code
  },
  t: String, // A | separated list of
  a: { type: [String] }, // Ancestors
  p: { type: [String] }, // Immediate parents
  c: { type: [String] }, // An array of strings of length n contained in t
}
```

It's also useful to have a collection called `codesWithWords` with the following structure:
```
{
  _id: {
    d: String, // The clinical code dictionary (EMIS/Readv2/SNOMED)
    c: String, // The clinical code
  },
  words: { type: [String] }, // An array of words in the definition
}
```

The search is then done by e.g. if looking for diabetes we first find all codes with a `c` array that contains `'diabet'`. Then from those returned filter them to just those that contain `'diabetes'`. Or if using whole words simple look in the `words` arrays for matches.

# Populating the db

The above is all found within `./scripts/best/`. It can be executed with:

```
node --max_old_space_size=4096 ./scripts/best/main.js | node_modules/.bin/pino
```

But first check out `./scripts/best/config.js` where you can tweak the below. As there are two stages (1. process the input files into a json file, 2. upload the json to mongo), we cache the json file to disk, allowing just stage 2 to occur.

```
BIT_LENGTH = 6; // can change the length of the chunks
CACHED_DIR = 'cache/best/'; // the location of the cached json file
CACHED_FILE = `bitLength${BIT_LENGTH}.json`; // the name of the cached json file
OVERWRITE_FILE = false; // whether to overwrite the file e.g. do stage 1 and 2, instead of just 2
MONGO_URL = process.env.GETSET_MONGO_URL; // the main mongo url
```

