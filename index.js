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
          dnode.connect(dbs[collectionName].config.port, function (remote, conn) {
            var attributes = null; // TODO
            remote.customer_info(function (result) {
                //sails.log.debug(result);
                sails.log.debug("result length: "+result.length);
                conn.end();
                cb(null, result);
            }, options.where.id, attributes);
          });
        break;
        case 'category':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            var store = null; // TODO
            var attributes = null; // TODO
            remote.category_info(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();
                if (!result.isArray)
                  result = [result];
                cb(null, result);
            }, options.where.id, store, attributes);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'product':
          var store = null; // TODO
          var attributes = null; //TODO 
          var identifierType = "id";
          var product;
          if (typeof(options.where.id) != "undefined" && options.where.id != null) {
            product = options.where.id;
          }
          else if (typeof(options.where.sku) != "undefined" && options.where.sku != null) {
            product = options.where.sku;
            identifierType = "sku";
          }
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            var store = null; // TODO
            var attributes = null; // TODO
            remote.product_export(function (result) {
              conn.end();
              if (!result.isArray)
                result = [result];
              cb(null, result);
            }, product, store, attributes, identifierType);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'attributeset':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote attributeset');
            remote.attributeset_export(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();
                if (!result.isArray)
                  result = [result];
                cb(null, result);
            }, options.where.id);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'productattribute':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote attributeset');
            remote.productattribute_items(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();
                if (!result.isArray)
                  result = [result];  
                cb(null, result);
            }, options.where.id);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
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
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            var store = null; // TODO
            remote.customer_items(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();
                if (!result.isArray)
                  result = [result];
                cb(null, result);
            }, null, store);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'category':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            var store = null; // TODO
            var parentId = null;
            remote.category_tree(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();
                cb(null, toArray (result));
            }, parentId, store);
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'product':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote');
            /*
             * Use "product_export" for much more information (slow and need much memory) and "product_items" for less information (slow but okay) in products
             */
            remote.product_items(function (items) {
                sails.log.debug("items length: "+items.length);
                conn.end();

                cb(null, toArray (items));
            });
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
          });
        break;
        case 'attributeset':
          var d = dnode.connect(dbs[collectionName].config.port);                
          d.on('remote', function (remote, conn) {
            sails.log.debug('remote attributeset');
            remote.attributeset_export(function (result) {
                sails.log.debug("result length: "+result.length);
                conn.end();

                cb(null, toArray (result));
            });
          });
          d.on('error', function (error) {
            sails.log.error(error);
            cb(error, []);
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

  function afterwards() {
    logic(connection, function(err, result) {
      if(cb) return cb(err, result);
    });
  }

  //Convert Object to Array
  function toArray(object) {
    var result_as_array = [];
    for (var i = 0; i < object.length; i++) {
      result_as_array.push(object[i]);
    };
    return result_as_array;
  }


  //////////////       End       //////////////////////////////////////////
  ////////////// Private Methods //////////////////////////////////////////
  //////////////                 //////////////////////////////////////////

  return adapter;
})();