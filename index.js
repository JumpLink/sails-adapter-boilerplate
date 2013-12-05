/*---------------------------------------------------------------
  :: sails-boilerplate
  -> adapter
---------------------------------------------------------------*/

var async = require('async')
  , _ = require('underscore')
  , dnode = require('dnode')
  , criteria = require('./criteria')
  , utils = require('./utils')
  , model = require('./model')
  ;

if(typeof(sails)==='undefined')
  sails = {
    log: {
      error : console.log,
      debug : console.log,
      info : console.log
    }
  }

module.exports = (function() {

  // Keep track of all the dbs used by the app
  var dbs = {}
    , schemaStash = {}
    ;

  // Holds an open connection
  var connection = {};

  var adapter = {

    // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
    // If true, the schema for models using this adapter will be automatically synced when the server starts.
    // Not terribly relevant if not using a non-SQL / non-schema-ed data store
    syncable: true,

    // Including a commitLog config enables transactions in this adapter
    // Please note that these are not ACID-compliant transactions: 
    // They guarantee *ISOLATION*, and use a configurable persistent store, so they are *DURABLE* in the face of server crashes.
    // However there is no scheduled task that rebuild state from a mid-step commit log at server start, so they're not CONSISTENT yet.
    // and there is still lots of work to do as far as making them ATOMIC (they're not undoable right now)
    //
    // However, for the immediate future, they do a great job of preventing race conditions, and are
    // better than a naive solution.  They add the most value in findOrCreate() and createEach().
    // 
    // commitLog: {
    //  identity: '__default_mongo_transaction',
    //  adapter: 'sails-mongo'
    // },

    // Default configuration for collections
    // (same effect as if these properties were included at the top level of the model definitions)
    defaults: {

      // For example:
      port: 6060,
      // host: 'localhost'

      // If setting syncable, you should consider the migrate option, 
      // which allows you to set how the sync will be performed.
      // It can be overridden globally in an app (config/adapters.js) and on a per-model basis.
      //
      // drop   => Drop schema and data, then recreate it
      // alter  => Drop/add columns as necessary, but try 
      // safe   => Don't change anything (good for production DBs)
      migrate: 'alter'
    },

    // This method runs when a model is initially registered at server start time
    registerCollection: function(collection, cb) {
      console.log("sails-magento: registerCollection: function(collection, cb)");
      console.log("\ncb: ");
      console.log(""+cb);

      console.log("\ncollection: ");
      console.log(collection);

      var self = this;

      // Load the url connection parameters if set
      collection.config = utils.parseUrl(collection.config);

      // If the configuration in this collection corresponds
      // with a known database, reuse it the connection(s) to that db
      dbs[collection.identity] = _.find(dbs, function(db) {
        return collection.database === db.database;
      });

      // Otherwise initialize for the first time
      if (!dbs[collection.identity]) {
        dbs[collection.identity] = collection;
      }

      // Holds the Schema
      dbs[collection.identity].schema = {};
      schemaStash[collection.identity] = collection.definition;

      cb();
    },


    // The following methods are optional
    ////////////////////////////////////////////////////////////

    // Optional hook fired when a model is unregistered, typically at server halt
    // useful for tearing down remaining open connections, etc.
    teardown: function(cb) {
      sails.log.debug("sails-magento: teardown: function("+cb+")");
      cb();
    },


    // REQUIRED method if integrating with a schemaful database
    define: function(collectionName, definition, cb) {
      sails.log.debug("sails-magento: define: function("+collectionName+", "+definition+", "+cb+")");
      // Define a new "table" or "collection" schema in the data store
      if(collectionName == "product") {
        model.product(function (err, attributes) {
          dbs[collectionName].schema = attributes;
          cb(null, dbs[collectionName].schema);
        });
      } else {
        cb(null, null);
      }
    },
    // REQUIRED method if integrating with a schemaful database
    describe: function(collectionName, cb) {
      sails.log.debug("sails-magento: describe: function("+collectionName+", "+cb+")");
      // Respond with the schema (attributes) for a collection or table in the data store
      if (collectionName === "product") {
        var des = Object.keys(dbs[collectionName].schema).length === 0 ? null : dbs[collectionName].schema;
        return cb(null, des);
      }
      else {
        return cb(null, null);
      }
    },
    // REQUIRED method if integrating with a schemaful database
    drop: function(collectionName, cb) {
      sails.log.debug("sails-magento: drop: function("+collectionName+", "+cb+")");
      // Drop a "table" or "collection" schema from the data store
      cb();
    },

    // Optional override of built-in alter logic
    // Can be simulated with describe(), define(), and drop(),
    // but will probably be made much more efficient by an override here
    alter: function (collectionName, attributes, cb) { 
      sails.log.debug("sails-magento: alter: function("+collectionName+", "+attributes+", "+cb+")");
      //Modify the schema of a table or collection in the data store
      cb(); 
    },


    // REQUIRED method if users expect to call Model.create() or any methods
    create: function(collectionName, values, cb) {
      sails.log.debug("sails-magento: create: function("+collectionName+", "+values+", "+cb+")");
      // Create a single new model specified by values

      // Respond with error or newly created model instance
      cb(null, values);
    },

    findOne: function(collectionName, options, cb) {
      sails.log.debug("sails-magento: findOne: function(collectionName, options, cb)");
      sails.log.debug("\ncollectionName:");
      sails.log.debug(collectionName);
      sails.log.debug("\noptions:");
      sails.log.debug(options);

      switch (collectionName) {
        case 'customer':
          MagentoAPI(dbs[collectionName].config.port, 'customer_info', 'info', [options.where.id, attributes], function (error, result) {
            cb(error, result);
          });
        break;
        case 'category':
          MagentoAPI(dbs[collectionName].config.port, 'product_export', 'info', [options.where.id, store, attributes], function (error, result) {
            cb(error, result);
          });
        break;
        case 'product':
          var product;
          var store = null;
          var all_stores = true;
          var attributes = null; //TODO ?
          var identifierType = "id";
          var integrate_set = false;
          var normalize = true;
          if (typeof(options.where.id) != "undefined" && options.where.id != null) {
            product = options.where.id;
          }
          else if (typeof(options.where.sku) != "undefined" && options.where.sku != null) {
            product = options.where.sku;
            identifierType = "sku";
          }
          MagentoAPI(dbs[collectionName].config.port, 'product_export', 'info', [product, store, all_stores, attributes, identifierType, integrate_set, normalize], function (error, result) {
            cb(error, result);
          });
        break;
        case 'attributeset':
          MagentoAPI(dbs[collectionName].config.port, 'attributeset_export', 'info', [options.where.id], function (error, result) {
            cb(error, result);
          });
        break;
        case 'productattribute':
          MagentoAPI(dbs[collectionName].config.port, 'productattribute_items', 'info', [options.where.id], function (error, result) {
            cb(error, result);
          });
        break;
        case 'store':
          MagentoAPI(dbs[collectionName].config.port, 'store_info', 'info', [options.where.id], function (error, result) {
            cb(error, result);
          });
        break;
        default:
          sails.log.debug("unknown collectionName");
          cb(null, {});
        break;
      }
    },

    findAll: function(collectionName, options, cb) {
      sails.log.debug("findAll");
      switch (collectionName) {
        case 'customer':
          var store = null; // TODO
          MagentoAPI(dbs[collectionName].config.port, 'customer_items', 'list', [null, store], function (error, result) {
            cb(error, result);
          });
        break;
        case 'category':
          var store = null; // TODO
          var parentId = null;
          MagentoAPI(dbs[collectionName].config.port, 'category_tree', 'info', [parentId, store], function (error, result) {
            cb(error, result);
          });
        break;
        case 'product':
          MagentoAPI(dbs[collectionName].config.port, 'product_items', 'list', [], function (error, result) {
            cb(error, result);
          });
        break;
        case 'attributeset':
          MagentoAPI(dbs[collectionName].config.port, 'attributeset_export', 'list', [], function (error, result) {
            cb(error, result);
          });
        break;
        case 'productattribute':
          MagentoAPI(dbs[collectionName].config.port, 'productattribute_all', 'list', [], function (error, result) {
            cb(error, result);
          });
        break;
        case 'store':
          MagentoAPI(dbs[collectionName].config.port, 'store_items', 'list', [], function (error, result) {
            cb(error, result);
          });
        break;
        default:
          sails.log.error("unknown collectionName");
          cb("unknown collectionName", []);
        break;
      }
    },

    // REQUIRED method if users expect to call Model.find(), Model.findOne() or related methods
    // You're actually supporting find(), findAll(), and other methods here
    // but the core will take care of supporting all the different usages.
    // (e.g. if this is a find(), not a findAll(), it will only send back a single model)
    find: function(collectionName, options, cb) {
      if (options.limit == 1 && (options.where.hasOwnProperty("id") || options.where.hasOwnProperty("sku") ))
        this.findOne(collectionName, options, cb);
      else if (options.where == null) {
        this.findAll(collectionName, options, cb);
      }
      else {
        sails.log.debug("sails-magento: find: function(collectionName, options, cb)");
        sails.log.debug("\ncollectionName:");
        sails.log.debug(collectionName);
        sails.log.debug("\noptions:");
        sails.log.debug(options);
        // ** Filter by criteria in options to generate result set

        // Rewrite where criteria
        if(options.where && options.limit != 1) {
          var where = {where: options.where };
          options.where = criteria.rewriteCriteria(where, schemaStash[collectionName], collectionName).where;
          sails.log.debug("\nrewriteCriteria result: ");
          sails.log.debug(options);
        }
        switch (collectionName) {

          case 'customer':
          break;
          case 'product':
            var d = dnode.connect(dbs[collectionName].config.port);                
            d.on('remote', function (remote, conn) {
              sails.log.debug('remote');
              var store = null; // TODO
              var attributes = null; //TODO 
              var identifierType = "id";
              remote.product_items_info_2(function (result) {
                  sails.log.debug("result length: "+result.length);
                  conn.end();
                  if (!result.isArray)
                    result = [result];
                  cb(null, result);
              }, options.where, store);
            });
            d.on('error', function (error) {
              sails.log.error(error);
              cb(null, []);
            });
          break;
          default:
            sails.log.error("unknown collectionName");
            cb(null, []);
          break;
        }
      }

      // Respond with an error or a *list* of models in result set
      
    },

    // REQUIRED method if users expect to call Model.update()
    update: function(collectionName, options, values, cb) {
      sails.log.debug("sails-magento: update: function(collectionName, options, values, cb)");
      sails.log.debug("\ncollectionName:");
      sails.log.debug(collectionName);
      sails.log.debug("\noptions:");
      sails.log.debug(options);
      sails.log.debug("\nvalues:");
      sails.log.debug(values);
      sails.log.debug("\ncb:");
      sails.log.debug(cb);
      // ** Filter by criteria in options to generate result set

      // Then update all model(s) in the result set
      sails.log.debug("update");
      switch (collectionName) {
        case 'customer':

        break;
        case 'category':

        break;
        case 'product':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            var store = null; // TODO
            var identifierType = "id"
            var id = options.where.id;
            remote.product_update(function (result) {
                conn.end();
                if(result === true)
                  result = [{id: id}];
                console.log(result);
                cb(null, result);
            }, id, values, store, identifierType);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'attributeset':

        break;
        default:
          sails.log.error("unknown collectionName");
          cb("unknown collectionName", []);
        break;
      }
      // Respond with error or a *list* of models that were updated
     // cb();
    },

    // REQUIRED method if users expect to call Model.destroy()
    destroy: function(collectionName, options, cb) {
      sails.log.debug("sails-magento: destroy: function("+collectionName+", "+options+", "+cb+")");
      // ** Filter by criteria in options to generate result set

      // Destroy all model(s) in the result set

      // Return an error or nothing at all
      cb();
    },



    // REQUIRED method if users expect to call Model.stream()
    stream: function(collectionName, options, stream) {
      sails.log.debug("sails-magento: stream: function("+collectionName+", "+options+", "+stream+")");
      // options is a standard criteria/options object (like in find)

      // stream.write() and stream.end() should be called.
      // for an example, check out:
      // https://github.com/balderdashy/sails-dirty/blob/master/DirtyAdapter.js#L247

    },



    /*
    **********************************************
    * Optional overrides
    **********************************************

    // Optional override of built-in batch create logic for increased efficiency
    // otherwise, uses create()
    createEach: function (collectionName, cb) { cb(); },

    // Optional override of built-in findOrCreate logic for increased efficiency
    // otherwise, uses find() and create()
    findOrCreate: function (collectionName, cb) { cb(); },

    // Optional override of built-in batch findOrCreate logic for increased efficiency
    // otherwise, uses findOrCreate()
    findOrCreateEach: function (collectionName, cb) { cb(); }
    */


    /*
    **********************************************
    * Custom methods
    **********************************************

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // > NOTE:  There are a few gotchas here you should be aware of.
    //
    //    + The collectionName argument is always prepended as the first argument.
    //      This is so you can know which model is requesting the adapter.
    //
    //    + All adapter functions are asynchronous, even the completely custom ones,
    //      and they must always include a callback as the final argument.
    //      The first argument of callbacks is always an error object.
    //      For some core methods, Sails.js will add support for .done()/promise usage.
    //
    //    + 
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////////


    // Any other methods you include will be available on your models
    foo: function (collectionName, cb) {
      cb(null,"ok");
    },
    bar: function (collectionName, baz, watson, cb) {
      cb("Failure!");
    }

    // Example success usage:

    Model.foo(function (err, result) {
      if (err) console.error(err);
      else sails.log.debug(result);

      // outputs: ok
    })

    // Example error usage:

    Model.bar(235, {test: 'yes'}, function (err, result){
      if (err) console.error(err);
      else sails.log.debug(result);

      // outputs: Failure!
    })
    */

    product_items: function (collectionName, cb) {
      var d = dnode.connect(dbs[collectionName].config.port);                
      d.on('remote', function (remote, conn) {
        sails.log.debug('remote');
        remote.product_items(function (result) {
            sails.log.debug("result length: "+result.length);
            conn.end();
            if (!result.isArray)
              result = [result];
            cb(null, result);
        });
      });
      d.on('error', function (error) {
        sails.log.error(error);
        cb(error, []);
      });
      cb("Failure!");
    },

    store_tree: function (collectionName, cb) {
      MagentoAPI(dbs[collectionName].config.port, 'store_tree', 'list', [], function (error, result) {
        cb(error, result);
      });
    }

  }

  //////////////      Start      //////////////////////////////////////////
  ////////////// Private Methods //////////////////////////////////////////
  //////////////                 //////////////////////////////////////////

  function spawnConnection (logic, config, cb) {
    if (connection !== {}) {
      cb();
    } else {
  
    }
  }

  function afterwards () {
    logic(connection, function(err, result) {
      if(cb) return cb(err, result);
    });
  }

  function MagentoAPI (port, functionname, resulttype, params, callback) {
    console.log("Magento API");
    var d = dnode.connect(port);                
    d.on('remote', function (remote, conn) {
      sails.log.debug('remote store');
      switch (params.length) {
        case 0:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          });
        break;
        case 1:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0]);
        break;
        case 2:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1]);
        break;
        case 3:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1], params[2]);
        break;
        case 4:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1], params[2], params[3]);
        break;
        case 5:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1], params[2], params[3], params[4]);
        break;
        case 6:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1], params[2], params[3], params[4], params[5]);
        break;
        case 7:
          remote[functionname](function (result) {
            sails.log.debug(result);
            conn.end();
            processedResult(resulttype, result, callback);
          }, params[0], params[1], params[2], params[3], params[4], params[5], params[6]);
        break;
      }

    });
    d.on('error', function (error) {
      sails.log.error(error);
      callback (error, []);
    });
  }

  function processedResult(resulttype, object, callback) {
    if(typeof (object.status) === 'undefined') {
      callback (null, toArray (resulttype, object));
    } else {
      switch (object.status) {
        case 400:
        case 403:
        case 404:
        case 500:
          callback (new Error(object.message), null);
        break;
        default: // TODO catch more status codes
          callback (null, toArray (resulttype, object));
        break;
      }
    }
  }

  //Convert Object to Array
  function toArray(resulttype, object) {
    // if is allready an array
    if (object.isArray)
      return object;
    else {
      var result_as_array = [];
      switch (resulttype) {
        case 'info':
          return [object];
        break;
        case 'list':
          if(typeof (object.length) === 'undefined') {
            return [object];
          } else {
            for (var i = 0; i < object.length; i++) {
              result_as_array.push(object[i]);
            };
            return result_as_array;
          }
        break;
      };
    }

  }


  //////////////       End       //////////////////////////////////////////
  ////////////// Private Methods //////////////////////////////////////////
  //////////////                 //////////////////////////////////////////

  return adapter;
})();