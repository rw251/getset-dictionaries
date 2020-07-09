const MongoClient = require('mongodb').MongoClient;

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'getset';

// Create a new MongoClient
const client = new MongoClient(url);
let db;
let readCodeCollection;
const tupleCollection = {};

let al = {};
let docs;
let called = 0;
const dotReplacement = '_/\\_';
const joiner = '||';

const getAllSubsequences = (arr, limit, insistOn) => {
  if(called > 0 && called%4000===0) {
    console.log(called);
  }
  called++;
  // const firstCharRegex = new RegExp('^[' + insistOn + ']');
	const findsubsequences = (arr, ans) => {
		if(ans.length === limit) {
      if(limit === 1) {
        const hash = ans.join(joiner);
        if(!al[hash]) al[hash] = 1;
        else al[hash] += 1;
      } else {
        const hash = ans.slice(1).join(joiner);
        if(!al[ans[0]]) al[ans[0]] = {};
        if(!al[ans[0]][hash]) al[ans[0]][hash] = 1;
        else al[ans[0]][hash] += 1;
      }
			return; 
    }
    if(arr.length === 0) {
      return;
    }
						
		findsubsequences(arr.slice(1),ans.concat(arr[0])) ; 
		findsubsequences(arr.slice(1),ans); 
	}

  //if(arr.filter(x => x.search(firstCharRegex) > -1 && x.length > 1).length === 0) return;
	const uniqueArray = Array.from(new Set(arr.filter(x => x.length>1)));
	findsubsequences(uniqueArray.sort(),[]);
};

const clearCollection = async (n) => tupleCollection[n].deleteMany({});

const doPles = async (n) => {
  called = 0;
  al = {};
  docs.forEach(doc => {
    getAllSubsequences(doc.w, n);
  });
  console.log(Object.keys(al).length);
  
  await clearCollection(n);
  const bulk = tupleCollection[n].initializeUnorderedBulkOp();
  if(n === 1) {
    Object.keys(al).forEach(x => {
      let xdot = x.replace(/\./g, dotReplacement);
      const item = {_id: xdot, n: al[x]};
      bulk.insert(item);
    })
  } else {
    Object.keys(al).forEach(x => {
      let xdot = x.replace(/\./g, dotReplacement);
      Object.keys(al[x]).forEach(y => {
        let ydot = y.replace(/\./g, dotReplacement);
        const item = {_id: [xdot, ydot].join(joiner), n: al[x][y]};
        bulk.insert(item);
      });
    })
  }
  await bulk.execute().catch(err => console.log(err));
}

const do1ples = async () => {
  docs.forEach(doc => {
    getAllSubsequences(doc.w, 1);
  });
  console.log(Object.keys(al).length);
  const bulk = tuple1Collection.initializeUnorderedBulkOp();
  Object.keys(al).forEach(x => {
    let xdot = x.replace(/\./g, dotReplacement);
    const item = {_id: xdot, n: al[x].n};
    bulk.insert(item);
  })
  await bulk.execute().catch(err => console.log(err));
}

const do2ples = async () => {
  docs.forEach(doc => {
    getAllSubsequences(doc.w, 2);
  });
  console.log(Object.keys(al).length);
  const bulk = tuple2Collection.initializeUnorderedBulkOp();
  Object.keys(al).forEach(x => {
    let xdot = x.replace(/\./g, dotReplacement);
    const item = {_id: xdot};
    Object.keys(al[x]).forEach(y => {
      let ydot = y.replace(/\./g, dotReplacement);
      item[ydot] = al[x][y].n;
    })
    bulk.insert(item);
  })
  await bulk.execute().catch(err => console.log(err));
}

const do3ples = async () => {
  docs.forEach(doc => {
    getAllSubsequences(doc.w, 3);
  });
  console.log(Object.keys(al).length);
  const bulk = tuple3Collection.initializeUnorderedBulkOp();
  Object.keys(al).forEach(x => {
    let xdot = x.replace(/\./g, dotReplacement);
    const item = {_id: xdot};
    Object.keys(al[x]).forEach(y => {
      let ydot = y.replace(/\./g, dotReplacement);
      item[ydot] = {};//al[x][y].n;
      Object.keys(al[x][y]).forEach(z => {
        let zdot = z.replace(/\./g, dotReplacement);
        item[ydot][zdot] = al[x][y][z].n;
      })
    })
    bulk.insert(item);
  })
  await bulk.execute().catch(err => console.log(err));
}

const do4ples = async () => {
  docs.forEach(doc => {
    getAllSubsequences(doc.w, 4, 'ab');
  });
  console.log(Object.keys(al).length);
  const bulk = tuple4Collection.initializeUnorderedBulkOp();
  Object.keys(al).forEach(x => {
    let xdot = x.replace(/\./g, dotReplacement);
    const item = {_id: xdot};
    Object.keys(al[x]).forEach(y => {
      let ydot = y.replace(/\./g, dotReplacement);
      item[ydot] = {};
      Object.keys(al[x][y]).forEach(z => {
        let zdot = z.replace(/\./g, dotReplacement);
        item[ydot][zdot] = {};
        Object.keys(al[x][y][z]).forEach(zz => {
          let zzdot = zz.replace(/\./g, dotReplacement);
          item[ydot][zdot][zzdot] = al[x][y][z][zz].n;
        })
      })
    })
    bulk.insert(item);
  })
  await bulk.execute().catch(err => console.log(err));
}

const connectToMongo = async () => {
  await client.connect();
  console.log("Connected successfully to server");
  db = client.db(dbName);
  readCodeCollection = db.collection('codes-Readv2');
  tupleCollection['1'] = db.collection('1ples');
  tupleCollection['2'] = db.collection('2ples');
  tupleCollection['3'] = db.collection('3ples');
  tupleCollection['4'] = db.collection('4ples');
  tupleCollection['5'] = db.collection('5ples');
  docs = await readCodeCollection.find({},{w:1,_id:0}).toArray();
}

const doItAll = async () => {
  await connectToMongo();
  // await do1ples();
  //await do2ples();
  // await do3ples();
  await doPles(1);
  await doPles(2);
  await doPles(3);
  await doPles(4);
}

doItAll()
  .then(() => client.close())
  .then(() => console.log('All done!'))
  .catch(err => console.log(err));
