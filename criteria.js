var _ = require('underscore')
  //,utils = require('./utils')
  ;

module.exports = {
  rewriteCriteria: function(options, schema, collectionName) {
    if (options.hasOwnProperty('where')) {

      switch (collectionName) {
        case "customer":
          if (options.where.id && !options.where.customer_id) {
            options.where['customer_id'] = _.clone(options.where.id);
            delete options.where.id
          }
        break;
        case "product":
          if (options.where.id && !options.where.product_id) {
            options.where['product_id'] = _.clone(options.where.id);
            delete options.where.id
          }
        break;
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
            // OPERATORS: http://www.fontis.com.au/blog/magento/web-services-api-filter-operators 
            switch (key) {
              case 'sort':
                //"dsc"  "asc"
              break;
              case 'contains':
                obj[key] = "in";
              break;
              case 'like':
              // like
              break;
              case 'startsWith':
                obj[key] = "from";
              break;
              case 'endsWith':
                obj[key] = "to";
              break;
              case 'lessThan':
              case '<':
                obj[key] = "lt";
              break;
              case 'lessThanOrEqual':
              case '<=':
                obj[key] = "lteq";
              break;
              case 'greaterThan':
              case '>':
                obj[key] = "gt";
              break;
              case 'greaterThanOrEqual':
              case '>=':
                obj[key] = "gteq";
              break;
              case 'not':
              case '!':
                obj[key] = "neq";
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