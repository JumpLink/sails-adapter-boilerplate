var _ = require('underscore')
  //,utils = require('./utils')
  ;

module.exports = {
  rewriteCriteria: function(options, schema) {
    if (options.hasOwnProperty('where')) {

      if (options.where.id && !options.where.customer_id) {
        options.where['customer_id'] = _.clone(options.where.id);
        delete options.where.id
      }
      options = this.normalizeCriteria(options);
    }
     return options;
  },
  /* For magento filter operators see: http://www.magentocommerce.com/api/rest/get_filters.html*/
  normalizeCriteria: function(query) {
    // Loop through each criteria attribute and normalize what it's looking for
    Object.keys(query).forEach(function(parent_key) {
      var obj = _.clone(query[parent_key]);
/*      console.log(parent_key);
      console.log(obj);*/

      if (parent_key === "where") {
        var filter = [];
        // Check if value is an object, if so just grab the first key
        if(_.isObject(obj)) {
          
          Object.keys(obj).forEach(function(key) {

            var val = obj[key];

            delete obj[key];
            filter.push ({"key": key, "value": val});

            switch (key) {
              case 'sort':
                //"dsc"  "asc"
              break;
              case 'contains':
              break;
              case 'like':
              break;
              case 'startsWith':
              break;
              case 'endsWith':
              break;
              case 'lessThan':
              case '<':
                // "lt"
              break;
              case 'lessThanOrEqual':
              case '<=':
              // "lte"
              break;
              case 'greaterThan':
              case '>':
                // "gt"
              break;
              case 'greaterThanOrEqual':
              case '>=':
                // "gte"
              break;
              case 'not':
              case '!':
                // "neq"
              break;
              default:

              break;
            }
          });
        }
        query[parent_key] = {filter: filter};
      }
    });

    return query;
  }
}