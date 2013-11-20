var adapter = require('./index.js');

module.exports = {

  product : function(cb) {
    adapter.find('attributeset', { where: null }, function (err, attributesets) {
      if(err != null) {
        console.log("error on generate product attributes");
        console.log(err);
        cb(err, null);
        return null;
      } else {
        //console.log("generate product attributes");
        //console.log(attributesets);
        var attributes = {};
        for (key in attributesets[0]) {
          for (attr_key in attributesets[0][key]["attributes"]) {
            var magento_attribute = attributesets[0][key]["attributes"][attr_key];
            var current_attribute = magento_attribute.attribute_code;
            var current_required = false;
            
            // Set this attribute as required only if it is required in all attribute sets
            if (key === "0") {
              if (magento_attribute.is_required === "1")
                current_required = true;
            }
            else
              if (typeof(attributes[current_attribute]) !== 'undefined' && attributes[current_attribute].required === true && magento_attribute.is_required === "1")
                current_required = true;

            var current_type = "";

            switch (magento_attribute.type) {
              case "array of integer":
              case "array of float":
              case "array of boolean":
                current_type = "array";
              break;
              case "integer":
              case "float":
              case "string":
              case "date":
              case "boolean":
              case "text":
              case "email":
              case "url":
              case "alpha":
              case "alphanumeric":
              case "weight":
              case "price":
              default:
                current_type = magento_attribute.type;
              break;
            }

            attributes[current_attribute] = {
              type: current_type,
              required: current_required
            };
          }
        };
        //console.log(attributes);
        return cb(null, attributes);
        //return attributes;
      }
    });
  }
};