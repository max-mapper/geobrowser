var GeoJSONHelper = function() {
  return {
    // map borrowed from http://github.com/janl/mustache.js/blob/master/mustache.js
    map : function(array, fn) {
      if (typeof array.map == "function") {
        return array.map(fn);
      } else {
        var r = [];
        var l = array.length;
        for(var i = 0; i < l; i++) {
          r.push(fn(array[i]));
        }
        return r;
      }
    },
    collect_geometries : function(geometries) {
      if (geometries.type == 'GeometryCollection')
        return geometries;
      return [{"type" : "GeometryCollection", "geometries" : geometries }]
    },
    collect_features : function(features){
      if (features.type == 'FeatureCollection')
        return features;
      return { "type" : "FeatureCollection", "features" : features }
    },
    pdxapi_feature_collection : function(data) {
      var features = GeoJSONHelper.map(data.rows, function(row){
        return {
          geometry: row.value.geometry,
          type: 'Feature',
          properties: {id: row.id}
        };
      });
      return GeoJSONHelper.collect_features(features);
    }
  }
}();

var Map = function() {
  return {
    couchUrl: "http://maxogden.couchone.com/",
    currentDataset: "",
    lon: -122.442429131298411,
    lat: 45.546590674495434,
    zoom: 17,
    fetchFeatures: function() {
      Indicator.show();
      $.ajax({
        url: Map.couchUrl + Map.currentDataset + "/_design/geojson/_spatial/points",
        dataType: 'jsonp',
        data: {
          "bbox": Map.container.getExtent().transform( proj900913, proj4326 ).toBBOX()
        },
        success: function(data){
          //var geometries = GeoJSONHelper.map(data.rows, function(row){
          //  return row.value.geometry
          //});
          Indicator.hide();
          var feature_collection = GeoJSONHelper.pdxapi_feature_collection(data);
          Map.drawFeature(Map.geojson_format.read(feature_collection));
        }
      })
    },
    drawFeature: function(feature) {
      for (var i = 0; i < feature.length; i++) {
        feature[i].geometry.transform(proj4326, proj900913);
      }
      Map.vector_layer.destroyFeatures();
      Map.vector_layer.addFeatures(feature);
    }
  }
}();

var Indicator = {
  show: function(text) {
    var top = $('#map').height() / 2 - 50;
    var left = $('#map').width() / 2 - 50;
    $('#loader').show().css({'top': top, 'left': left});
  },
  hide: function() {
    $('#loader').hide();
  }
}

var showing_layers = [];

$(function() {
  OpenLayers.ImgPath="themes/dark/"
  $.ajax({
    url: Map.couchUrl + "_all_dbs",
    dataType: 'jsonp',
    success: function(databases){
      var dbList = $('#databases');
      $.each(databases.sort(), function(index, database){
              if (database !== "_users" && database !== "_replicator") {
          dbList.append('<li>' + database + '</li>');
              }
              $('#databases li:first').click();
      });
    }
  });

  proj900913 = new OpenLayers.Projection("EPSG:900913"); //Spherical mercator used for google maps
  proj4326 = new OpenLayers.Projection("EPSG:4326"); 
  var pdxLL = new OpenLayers.LonLat(-122.69256591796875,45.4947963896697);
  var pdxUR = new OpenLayers.LonLat(-122.552490234375,45.58136746810096);
  pdxLL.transform( proj4326, proj900913 );
  pdxUR.transform( proj4326, proj900913 );
  Map.options = {
    maxExtent: new OpenLayers.Bounds(pdxLL.lon,pdxLL.lat, pdxUR.lon,pdxUR.lat),    
    restrictedExtent: new OpenLayers.Bounds(pdxLL.lon,pdxLL.lat, pdxUR.lon,pdxUR.lat),
    numZoomLevels: 20,
    maxResolution: 156543.0339,
    projection: proj900913,
    displayProjection: proj4326,
    tileSize: new OpenLayers.Size(256, 256),
    controls: [
      new OpenLayers.Control.Navigation(),
      new OpenLayers.Control.PanZoomBar(),
      new OpenLayers.Control.KeyboardDefaults()
    ]
  };
  Map.container = new OpenLayers.Map('map', Map.options);
  Map.gmap = new OpenLayers.Layer.Google("Google Streets", {"sphericalMercator": true ,numZoomLevels: 20}); 
  Map.container.addLayer(Map.gmap);

  Map.styleMap = new OpenLayers.StyleMap({
    'default': OpenLayers.Util.applyDefaults({
      fillOpacity: 0.2, 
      strokeColor: "black", 
      strokeWidth: 3,
      pointRadius: 10
    }),
    /*'select': new OpenLayers.Style({
      pointRadius: 20
    })*/
  });

  Map.vector_layer = new OpenLayers.Layer.Vector("GeoJSON", {
    projection: proj4326, 
    styleMap: Map.styleMap
  });
  Map.container.addLayer(Map.vector_layer);

  var report = function(e) {
      console.log(e.type + ": " + e.feature.id);
  };

  var highlightCtrl = new OpenLayers.Control.SelectFeature(Map.vector_layer, {
      hover: true,
      highlightOnly: true,
      renderIntent: "temporary",
      eventListeners: {
          beforefeaturehighlighted: report,
          featurehighlighted: report,
          featureunhighlighted: report
      }
  });

  var selectCtrl = new OpenLayers.Control.SelectFeature(Map.vector_layer, {
      eventListeners: {
          featurehighlighted: report,
          featureunhighlighted: report
      },
      clickout: true
  });

  Map.container.addControl(highlightCtrl);
  Map.container.addControl(selectCtrl);

  highlightCtrl.activate();
  selectCtrl.activate();

  Map.geojson_format = new OpenLayers.Format.GeoJSON();     

  Map.container.setCenter(new OpenLayers.LonLat(-122.6762071,45.5234515), Map.zoom);
  Map.container.events.register( 'moveend', this, function(){ Map.fetchFeatures() });

  if (OpenLayers.Control.MultitouchNavigation) {
    var touchControl = new OpenLayers.Control.MultitouchNavigation();
    Map.container.addControl(touchControl);
  }

  $('#databases li').live('click', function(){
    var dataset = $(this).text();
    $('.selected').removeClass('selected');
    $(this).addClass('selected');
    Map.currentDataset = dataset;
    Map.fetchFeatures();
  });
});
