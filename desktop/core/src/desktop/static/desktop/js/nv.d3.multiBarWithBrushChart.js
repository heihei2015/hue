// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


nv.models.multiBarWithBrushChart = function() {
  "use strict";
  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var LABELS = {
    STACKED: "Stacked",
    GROUPED: "Grouped",
    SELECT: "Enable selection"
  }

  var multibar = nv.models.growingMultiBar()
    , xAxis = nv.models.axis()
    , yAxis = nv.models.axis()
    , legend = nv.models.legend()
    , controls = nv.models.legend()
    , brush = d3.svg.brush()
    ;

  var margin = {top: 30, right: 20, bottom: 50, left: 60}
    , width = null
    , height = null
    , color = nv.utils.defaultColor()
    , showControls = true
    , showLegend = true
    , showXAxis = true
    , showYAxis = true
    , rightAlignYAxis = false
    , reduceXTicks = true // if false a tick will show for every data point
    , staggerLabels = false
    , rotateLabels = 0
    , tooltips = true
    , tooltip = function(key, x, y, e, graph) {
        return '<h3>' + key + '</h3>' +
               '<p>' +  y + ' on ' + x + '</p>'
      }
    , x //can be accessed via chart.xScale()
    , y //can be accessed via chart.yScale()
    , state = { stacked: false }
    , defaultState = null
    , noData = "No Data Available."
    , dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'stateChange', 'changeState', 'brush')
    , controlWidth = function() { return showControls ? (selectionHidden ? 240 : 300) : 0 }
    , transitionDuration = 250
    , extent
    , brushExtent = null
    , selectionEnabled = false
    , selectionHidden = false
    , onSelectRange = null
    , onStateChange = null
    , onChartUpdate = null
    , selectBars = null
    ;

  multibar
    .stacked(false)
    ;
  xAxis
    .orient('bottom')
    .tickPadding(7)
    .highlightZero(true)
    .showMaxMin(false)
    .tickFormat(function(d) { return d })
    ;
  yAxis
    .orient((rightAlignYAxis) ? 'right' : 'left')
    .tickFormat(d3.format(',.1f'))
    ;

  controls.updateState(false);
  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var showTooltip = function(e, offsetElement) {
    var left = ($.browser.msie && $.browser.version.indexOf("9.") > -1) ? e.e.clientX : e.e.layerX,
        top = e.pos[1] + ( offsetElement.offsetTop || 0),
        x = xAxis.tickFormat()(multibar.x()(e.point, e.pointIndex)),
        y = yAxis.tickFormat()(multibar.y()(e.point, e.pointIndex)),
        content = tooltip(e.series.key, x, y, e, chart);

    nv.tooltip.show([left, top], content, e.value < 0 ? 'n' : 's', null, offsetElement);
  };

  //============================================================


  function chart(selection) {
    selection.each(function(data) {
      var container = d3.select(this),
          that = this;

      var availableWidth = (width  || parseInt(container.style('width')) || 960)
                             - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom;

      chart.update = function() {
        container
            .transition()
            .duration(transitionDuration)
            .each("end", onChartUpdate)
            .call(chart);
        if (selectionEnabled){
          enableBrush();
        }
        else {
          disableBrush();
        }
      };
      chart.container = this;

      //set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled });

      if (!defaultState) {
        var key;
        defaultState = {};
        for (key in state) {
          if (state[key] instanceof Array)
            defaultState[key] = state[key].slice(0);
          else
            defaultState[key] = state[key];
        }
      }
      //------------------------------------------------------------
      // Display noData message if there's nothing to show.

      if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
        var noDataText = container.selectAll('.nv-noData').data([noData]);

        noDataText.enter().append('text')
          .attr('class', 'nvd3 nv-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) { return d });

        container.selectAll('.nv-multiBarWithLegend').style('visibility', 'hidden');
        container.selectAll('.nv-noData').style('visibility', 'visible');

        return chart;
      } else {
        container.selectAll('.nv-multiBarWithLegend').style('visibility', 'visible');
        container.selectAll('.nv-noData').style('visibility', 'hidden');
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup Scales

      x = multibar.xScale();
      y = multibar.yScale();

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap = container.selectAll('g.nv-wrap.nv-multiBarWithLegend').data([data]);
      var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multiBarWithLegend').append('g');
      var g = wrap.select('g');

      gEnter.append('g').attr('class', 'nv-x nv-axis');
      gEnter.append('g').attr('class', 'nv-y nv-axis');
      gEnter.append('g').attr('class', 'nv-barsWrap');
      gEnter.append('g').attr('class', 'nv-legendWrap');
      gEnter.append('g').attr('class', 'nv-controlsWrap');


      //------------------------------------------------------------


      //------------------------------------------------------------
      // Legend

      if (showLegend) {
        legend.width(availableWidth - controlWidth());

        if (multibar.barColor())
          data.forEach(function(series,i) {
            series.color = d3.rgb('#ccc').darker(i * 1.5).toString();
          })

        try {
          g.select('.nv-legendWrap')
              .datum(data)
              .call(legend);
        }
        catch (e){}

        if ( margin.top != legend.height()) {
          margin.top = legend.height();
          availableHeight = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom;
        }

        g.select('.nv-legendWrap')
            .attr('transform', 'translate(' + controlWidth() + ',' + (-margin.top) +')');
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Controls

      if (showControls) {
        var controlsData = [
          { key: LABELS.GROUPED, disabled: multibar.stacked() },
          { key: LABELS.STACKED, disabled: !multibar.stacked() }
        ];

        if (! selectionHidden) {
          controlsData.push({ key: LABELS.SELECT, disabled: !selectionEnabled, checkbox: true });
        }

        controls.width(controlWidth()).color(['#444', '#444', '#444']);
        g.select('.nv-controlsWrap')
            .datum(controlsData)
            .attr('transform', 'translate(0,' + (-margin.top) +')')
            .call(controls);
      }

      //------------------------------------------------------------


      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      if (rightAlignYAxis) {
          g.select(".nv-y.nv-axis")
              .attr("transform", "translate(" + availableWidth + ",0)");
      }

      //------------------------------------------------------------
      // Main Chart Component(s)

      multibar
        .disabled(data.map(function(series) { return series.disabled }))
        .width(availableWidth)
        .height(availableHeight)
        .color(data.map(function(d,i) {
          return d.color || color(d, i);
        }).filter(function(d,i) { return !data[i].disabled }))

      selectBars = multibar.selectBars;

      var dataBars = data.filter(function(d) { return !d.disabled && d.bar });
      var barsWrap = g.select('.nv-barsWrap')
          .datum(data.filter(function(d) { return !d.disabled }))

      barsWrap.transition().call(multibar);

      //------------------------------------------------------------

      //------------------------------------------------------------
      // Setup Brush
      if (selectionEnabled){
        enableBrush();
      }


      function enableBrush() {
        if (g.selectAll('.nv-brush')[0].length == 0) {
          gEnter.append('g').attr('class', 'nv-brushBackground');
          gEnter.append('g').attr('class', 'nv-x nv-brush');
          brush
              .x(x)
              .on('brush', onBrush)
              .on('brushstart', onBrushStart)
              .on('brushend', onBrushEnd)

          if (brushExtent) brush.extent(brushExtent);
          var brushBG = g.select('.nv-brushBackground').selectAll('g')
              .data([brushExtent || brush.extent()])
          var brushBGenter = brushBG.enter()
              .append('g');

          brushBGenter.append('rect')
              .attr('class', 'left')
              .attr('x', 0)
              .attr('y', 0)
              .attr('height', availableHeight);

          brushBGenter.append('rect')
              .attr('class', 'right')
              .attr('x', 0)
              .attr('y', 0)
              .attr('height', availableHeight);

          var gBrush = g.select('.nv-x.nv-brush')
              .call(brush);
          gBrush.selectAll('rect')
              .attr('height', availableHeight);
        }
        else {
          g.selectAll('.nv-brush').attr('display', 'inline');
        }
      }

      function disableBrush() {
        try {
          g.selectAll('.nv-brush').attr('display', 'none');
        }
        catch (e){}
      }


      //------------------------------------------------------------
      // Setup Axes

      if (showXAxis) {
          xAxis
            .scale(x)
            .ticks( availableWidth / 100 )
            .tickSize(-availableHeight, 0);

          g.select('.nv-x.nv-axis')
              .attr('transform', 'translate(0,' + y.range()[0] + ')');
          g.select('.nv-x.nv-axis').transition()
              .call(xAxis);

          var xTicks = g.select('.nv-x.nv-axis > g').selectAll('g');

          xTicks
              .selectAll('line, text')
              .style('opacity', 1)

          if (staggerLabels) {
              var getTranslate = function(x,y) {
                  return "translate(" + x + "," + y + ")";
              };

              var rangeBand = x.rangeBand();

              var staggerUp = 5, staggerDown = 17;  //pixels to stagger by
              // Issue #140
              xTicks
                .selectAll("text")
                .attr('transform', function(d,i,j) {
                    var self = d3.select(this),
                      textLength = self.node().getComputedTextLength(),
                      text = self.text();
                    while (textLength > rangeBand && text.length > 0) {
                      text = text.slice(0, -1);
                      self.text(text + '...');
                      textLength = self.node().getComputedTextLength();
                    }
                    return  getTranslate(0, (j % 2 == 0 ? staggerUp : staggerDown));
                  });

              var totalInBetweenTicks = d3.selectAll(".nv-x.nv-axis .nv-wrap g g text")[0].length;
              g.selectAll(".nv-x.nv-axis .nv-axisMaxMin text")
                .attr("transform", function(d,i) {
                    return getTranslate(0, (i === 0 || totalInBetweenTicks % 2 !== 0) ? staggerDown : staggerUp);
                });
          }

          if (reduceXTicks)
            xTicks
              .filter(function(d,i) {
                  return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                })
              .selectAll('text, line')
              .style('opacity', 0);

          if(rotateLabels)
            xTicks
              .selectAll('.tick text')
              .attr('transform', 'rotate(' + rotateLabels + ' 0,0)')
              .style('text-anchor', rotateLabels > 0 ? 'start' : 'end');

          g.select('.nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
              .style('opacity', 1);
      }


      if (showYAxis) {
          yAxis
            .scale(y)
            .ticks( availableHeight / 36 )
            .tickSize( -availableWidth, 0);

          g.select('.nv-y.nv-axis').transition()
              .call(yAxis);
      }


      //------------------------------------------------------------



      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('stateChange', function(newState) {
        state = newState;
        dispatch.stateChange(state);
        chart.update();
      });

      controls.dispatch.on('legendClick', function(d,i) {
        if (typeof d.checkbox == "undefined"){
          if (!d.disabled) return;
          controlsData = controlsData.map(function(s) {
            s.disabled = true;
            return s;
          });
          d.disabled = false;
        }

        switch (d.key) {
          case LABELS.GROUPED:
            multibar.stacked(false);
            break;
          case LABELS.STACKED:
            multibar.stacked(true);
            break;
          case LABELS.SELECT:
            selectionEnabled = !selectionEnabled;
            break;
        }

        state.stacked = multibar.stacked();
        if (onStateChange != null) {
          onStateChange(state);
        }
        dispatch.stateChange(state);
        chart.update();
      });

      dispatch.on('tooltipShow', function(e) {
        if (tooltips) showTooltip(e, that.parentNode)
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(e) {

        if (typeof e.disabled !== 'undefined') {
          data.forEach(function(series,i) {
            series.disabled = e.disabled[i];
          });

          state.disabled = e.disabled;
        }

        if (typeof e.stacked !== 'undefined') {
          multibar.stacked(e.stacked);
          state.stacked = e.stacked;
        }

        chart.update();
      });

      //============================================================


      function onBrush(){
        brushExtent = brush.empty() ? null : brush.extent();
        extent = brush.empty() ? x.domain() : brush.extent();

        dispatch.brush({extent: extent, brush: brush});
      }

      function onBrushStart(){
        gEnter.select(".nv-brush").select(".extent").style("display", "block");
      }

      function onBrushEnd(){
        brushExtent = brush.empty() ? null : brush.extent();
        extent = brush.empty() ? x.domain() : brush.extent();

        if (onSelectRange != null){
          var _leftEdges = x.range();
          var _width = x.rangeBand();
          var _j;
          for(_j=0; extent[0] > (_leftEdges[_j] + _width); _j++) {}
          var _from = typeof x.domain()[_j] != "undefined" ? x.domain()[_j] : x.domain()[0];

          for(_j=0; extent[1] > (_leftEdges[_j] + _width); _j++) {}
          var _to = typeof x.domain()[_j] != "undefined" ? x.domain()[_j] : x.domain()[x.domain().length-1];

          onSelectRange(_from, _to);
        }

        gEnter.select(".nv-brush").select(".extent").style("display", "none");
      }
    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  multibar.dispatch.on('elementMouseover.tooltip', function(e) {
    e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
    dispatch.tooltipShow(e);
  });

  multibar.dispatch.on('elementMouseout.tooltip', function(e) {
    dispatch.tooltipHide(e);
  });
  dispatch.on('tooltipHide', function() {
    if (tooltips) nv.tooltip.cleanup();
  });

  //============================================================


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.multibar = multibar;
  chart.legend = legend;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;
  chart.LABELS = LABELS;

  d3.rebind(chart, multibar, 'x', 'y', 'xDomain', 'yDomain', 'xRange', 'yRange', 'forceX', 'forceY', 'clipEdge',
   'id', 'stacked', 'stackOffset', 'delay', 'barColor','groupSpacing');

  chart.options = nv.utils.optionsFunc.bind(chart);

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = nv.utils.getColor(_);
    legend.color(color);
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) return showControls;
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) return showLegend;
    showLegend = _;
    return chart;
  };

  chart.showXAxis = function(_) {
    if (!arguments.length) return showXAxis;
    showXAxis = _;
    return chart;
  };

  chart.showYAxis = function(_) {
    if (!arguments.length) return showYAxis;
    showYAxis = _;
    return chart;
  };

  chart.rightAlignYAxis = function(_) {
    if(!arguments.length) return rightAlignYAxis;
    rightAlignYAxis = _;
    yAxis.orient( (_) ? 'right' : 'left');
    return chart;
  };

  chart.reduceXTicks= function(_) {
    if (!arguments.length) return reduceXTicks;
    reduceXTicks = _;
    return chart;
  };

  chart.rotateLabels = function(_) {
    if (!arguments.length) return rotateLabels;
    rotateLabels = _;
    return chart;
  }

  chart.staggerLabels = function(_) {
    if (!arguments.length) return staggerLabels;
    staggerLabels = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) return tooltip;
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) return tooltips;
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) return tooltip;
    tooltip = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) return state;
    state = _;
    return chart;
  };

  chart.defaultState = function(_) {
    if (!arguments.length) return defaultState;
    defaultState = _;
    return chart;
  };

  chart.noData = function(_) {
    if (!arguments.length) return noData;
    noData = _;
    return chart;
  };

  chart.transitionDuration = function(_) {
    if (!arguments.length) return transitionDuration;
    transitionDuration = _;
    return chart;
  };

  chart.enableSelection = function() {
    selectionEnabled = true;
    return chart;
  };

  chart.disableSelection = function() {
    selectionEnabled = false;
    return chart;
  };

  chart.hideSelection = function() {
    selectionHidden = true;
    selectionEnabled = false;
    return chart;
  }

  chart.onSelectRange = function(_) {
    if (!arguments.length) return onSelectRange;
    onSelectRange = _;
    return chart;
  };

  chart.onStateChange = function(_) {
    if (!arguments.length) return onStateChange;
    onStateChange = _;
    return chart;
  };

  chart.onChartUpdate = function(_) {
    if (!arguments.length) return onChartUpdate;
    onChartUpdate = _;
    return chart;
  };

  chart.selectBars = function(args) {
    if (!arguments.length) return selectBars;
    if (selectBars) {
      selectBars(args);
    }
    return chart;
  };

  chart.brush = function(_) {
    if (!arguments.length) return brush;
    brush = _;
    return chart;
  };


  //============================================================


  return chart;
}


