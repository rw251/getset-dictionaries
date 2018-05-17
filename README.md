# Populating the mongodbs

Currently the best approach is to store a terminology in a collection called `codes` with an object structure as follows:

```
{
  _id: String, // The clinical code
  t: String, // A | separated list of descriptions (NOT synonyms) e.g. in Readv2 there is a short, medium and long definition
  a: { type: [String] }, // Array of ancestor codes
  p: { type: [String] }, // Array of immediate parents
  c: { type: [String] }, // An array of strings created by chopping the definition up into 6 character chunks.
}
```

The search is then done by e.g. if looking for diabetes we first find all codes with a `c` array that contains `'diabet'`. Then from those returned filter them to just those that contain `'diabetes'`.

# Populating the db

The above is all found within `./scripts/2/`. It can be executed with:

```
node ./scripts/2/main.js
```

But first check out `./scripts/2/config.js` where you can tweak the below. As there are two stages (1. process the input files into a json file, 2. upload the json to mongo), we cache the json file to disk, allowing just stage 2 to occur.

```
BIT_LENGTH = 6; // can change the length of the chunks
CACHED_DIR = 'cache/2/'; // the location of the cached json file
CACHED_FILE = `bitLength${BIT_LENGTH}.json`; // the name of the cached json file
OVERWRITE_FILE = false; // whether to overwrite the file e.g. do stage 1 and 2, instead of just 2
MONGO_URL = process.env.GETSET_MONGO_URL; // the main mongo url - currently where read v2 ends up
MONGO_URL_EMIS = process.env.GETSET_MONGO_URL_EMIS; // another mongo url, this one for EMIS codes
```

# One mongodb per terminology
I'm hosting the service with mlab.com which has a restriction of 500Mb per free instance. To enable multiple terminologies I've therefore create a new instance for each terminology - pragmatic rather than particularly well designed.

