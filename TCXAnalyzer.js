// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Classes required to store the current application state

class ActivityChartData {
    constructor(context, xAxis,yAxis, chartType) {
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.context = context;
        this.chartType = chartType;
    }
}

class TCXConfig {
    constructor() {
        this.tcxData = [];
        this.startIndex = 0;
        this.endIndex = 100;
        this.chartList = {}
        this.xmlParser = getXMLParser();
    }

    resetConfig() {
        this.tcxData = [];
        this.startIndex = 0;
        this.endIndex = 100;
    }

    destroyAllCharts() {
        Object.keys(this.chartList).forEach(chartKey => {
            const activityGraph = this.chartList[chartKey];
            if (activityGraph.chartObj !== undefined) {
                activityGraph.chartObj.destroy();
                activityGraph.chartObj = undefined;
            }
        })
    } 

    removeDataFromCharts(length, location) {
        Object.keys(this.chartList).forEach(chartKey => {
            const activityGraph = this.chartList[chartKey];
            if (activityGraph.chartObj !== undefined) {
                if (location === 'beginning') {
                        activityGraph.chartObj.data.datasets[0].data.splice(0,length);
                    } else {
                        activityGraph.chartObj.data.datasets[0].data.splice(-length,length);
                    }
                activityGraph.chartObj.update();                            
            }
        });
    }

    addDataToCharts(startIndex, endIndex, location) {
        Object.keys(this.chartList).forEach(chartKey => {
            const activityGraph = this.chartList[chartKey];
            const newData = getChartData(this.tcxData,activityGraph.xAxis, activityGraph.yAxis,startIndex, endIndex);
            if (location === 'beginning') {
                activityGraph.chartObj.data.datasets[0].data.splice(0,0,...newData);
            } else {
                activityGraph.chartObj.data.datasets[0].data = activityGraph.chartObj.data.datasets[0].data.concat(newData);
            }
            activityGraph.chartObj.update();

        });

    }

    addChart(context, xAxis, yAxis, chartType) {
        const newChart = new ActivityChartData(context, xAxis, yAxis, chartType);
        this.chartList[context.canvas.id] = newChart;
        newChart.chartObj = createNewChart(context, this.tcxData, xAxis, yAxis, chartType);
    }
    
    /** Main function which reads the content of a TCX file and adds data to the internal structure
     * @param  {string} textContent - string which contains the TCX file content (expected to be the output of a file read)
     */
    parseXMLData(textContent) {
        // Defining a recursive helper function to browse through the XML tree and fill the data structure accordingly
        function parseXMLTreeAndFillArray(xml) {
            if (xml.nodeType === 1 && xml.nodeName === 'Trackpoint') {
                const tp = new Trackpoint(xml);
                this.tcxData.push(tp);
            } else {
                for (let i=0; i < xml.childElementCount; i++) {
                    parseXMLTreeAndFillArray.call(this,xml.children[i]);
                }
            }
        }

        this.tcxData = [];
        const xmlDocumentTree = this.xmlParser(textContent);
        parseXMLTreeAndFillArray.call(this,xmlDocumentTree);
        this.startIndex = 0;
        this.endIndex = this.tcxData.length-1;
    }

    refreshWholeGraph(canvasID, newXAxis, newYAxis) {
        const curGraph = this.chartList[canvasID];
        if (curGraph.chartObj !== undefined) {
            curGraph.chartObj.destroy();
        }
        curGraph.xAxis = newXAxis;
        curGraph.yAxis = newYAxis;
        curGraph.chartObj = createNewChart(curGraph.context, this.tcxData, curGraph.xAxis, curGraph.yAxis, curGraph.chartType);
    }

}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class Trackpoint {
    
    constructor(xml) {
        if (xml.nodeType !== 1 || xml.nodeName !== 'Trackpoint' ) {
            // Should maybe raise an error there
            console.error('Wrong XML node passed to Trackpoint conversion!')
            return;
        }
        this.setProperties(xml);
     }
     /**
      * Returns a string which corresponds to a "beautification" of the XML nodename
      * Using a function to protect the data structure (no private values in JS)
      * and because the "static" function is not implemented in Safari
      * @param  {xmlLabel} xmlLabel - the xml.nodeName of TCX file node
      * @returns {string} - internal application label corresponding to this XML parameter
      */ 
     getPropertyName(xmlLabel) {
         const keyProperties = {
            'ns3:Speed' : 'speed',
            'LatitudeDegrees' : 'lat',
            'LongitudeDegrees' : 'long',
            'Time' : 'timestamp',
            'AltitudeMeters' : 'altitude',
            'DistanceMeters' : 'distance',
            'HeartRateBpm' : 'hr',
        };

        return keyProperties[xmlLabel];
     }

    /**
     * Looks at the current XML node and its children and adds the datapoint properties to the current data point
     * @param  {xmlNode} xml - the XML Element on which to apply this function
     */
    setProperties(xml) {
        if (xml.nodeType === 1 && this.getPropertyName(xml.nodeName)) {
            const propertyName = this.getPropertyName(xml.nodeName);
            this[propertyName] = xml.textContent.trim();
        }
        for (let i=0; i< xml.childElementCount; i++) {
            this.setProperties(xml.children[i]);
        }
    }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CHART-RELATED ROUTINES
/**
 * function which looks at all the Chart instances and returns the Chart.js contained in the context
 * @param  {2Dcontext} context - the context which contains the Chart.js object
 */
function getChartFromContext(context) {
    
    for (let chartId in Chart.instances) {
        let currentChart = Chart.instances[chartId];
        if (currentChart.ctx === context) {
            return currentChart;
        }
    }
    return undefined;

}
/**
 * returns a string corresponding to the color code of a point in the data
 * @param  {object} context - contains information about the current data point, see Chart.js documentation.
 * @see {@link https://www.chartjs.org/docs/latest/general/options.html} -  JS Chart documentation
 */
function gradientColor(context) {
    var index = context.dataIndex;
    var totalNumber = context.dataset.data.length;
    return `hsl(30,${Math.trunc(index/totalNumber*100)}%,50%)`    
}

/**
 * Creates the chart.js objects while defining all the options
 * @param  {2DContext} context - 2DContext which points to the canvas where the Chart will be added
 * @param  {Array} dataTable - 
 * @param  {String} xAxis - contains the string descriptor for the xAxis. If equal to 'time', the X scale will be time-based
 * @param  {String} yAxis - contains the string descriptor for y Axis
 * @param  {String} chartType='linear' - chart.js chartType which will be created (expect 'linear' or 'scatter')
 */
function createNewChart(context, dataTable, xAxis, yAxis, chartType='line') {
    const chartData = getChartData(dataTable, xAxis, yAxis);
    let xAxisOptions = [];

    if (xAxis === 'time') {
        xAxisOptions = [{
            type:'time',
            time: {
                //2021-03-15T01:42:26.000Z
                parser: "YYYY-MM-DDTHH:MM:SS",
            }
        }];
    } else {
        xAxisOptions = [{
            type:'linear',
            position: 'bottom',
            scaleLabel: {
                display: true,
                labelString: xAxis
            },
        }];
    }

    const timeSeriesChart = new Chart(context,
        { type: chartType, 
        data: {
            datasets: [{
                label: `${yAxis}=f(${xAxis})`,
                data: chartData,
                borderColor: gradientColor,
                fill: false,
           }],
        },
        options: {
            responsive:false,
            maintainAspectRatio:true,
            legend:false,
            scales: {
                xAxes: xAxisOptions ,
                yAxes: [{
                    display:'true',
                    scaleLabel: {
                        display: true,
                        labelString: yAxis
                    },
                }]
            }
        }
       } );
    return timeSeriesChart;

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// DATA MANIPULATION ROUTINES

/**
 * returns an array of datapoints compatible with Chart.js according to filtering and selecting parameters
 * Note that the (startIndex, endIndex) can be outside of the current plotted range, in such case it is used to retrieve
 * data previously discarded
 * @param  {Array} dataArray - array of TCX points
 * @param  {String} xAxis - contains description of X array data, or 'time' for time-scale charts
 * @param  {String} yAxis - contains description of Y axis data
 * @param  {Integer} startIndex=0 - index used to filter the data: index at which we start to plot
 * @param  {Integer} endIndex - index at which we end to plot
 * @returns {Array} - array of points objects {x: ... , y: ...} which will be plotted in a canvas
 */
function getChartData(dataArray, xAxis, yAxis, startIndex=0, endIndex) {
    const selector = {
        'time' : (tp => new Date(tp.timestamp)),
        'speed': (tp => tp.speed*3.6),
        'altitude' : (tp => tp.altitude*1),
        'hr' : (tp => tp.hr*1),
        'distance' : (tp => tp.distance*1),
    }
    
    const getXData = selector[xAxis] || selector['time'];
    const getYData = selector[yAxis] || selector['speed'];

    return dataArray.filter( (_unused,index) => ((index >= startIndex) && (index <= (endIndex || dataArray.length-1  ) )))
        .map( tp => ({ x: getXData(tp), y: getYData(tp)}));

}

/**
 * will set the innerText properties of the labels nearby the slider according to the slider values.
 * @param  {nodeElement} slider - div element containing the slider widget
 * @param  {TCXConfig} tcxConfig - config element used to convert the scale slider position into data timestamps
 */
function updateSliderWidgets(slider, tcxConfig) {
    const [start, stop] = slider.noUiSlider.get();

    if (tcxConfig === undefined || tcxConfig.tcxData === undefined || tcxConfig.tcxData.length === 0) {
        // Error case
        document.getElementById('sliderMin').innerText = start;
        document.getElementById('sliderMax').innerText = stop;
    } else {
        // Updating the labels near the slider widget
        const firstIndex = Math.trunc(start/100*(tcxConfig.tcxData.length-1));
        const lastIndex = Math.trunc(stop/100*(tcxConfig.tcxData.length-1));
        const firstDate = new Date(tcxConfig.tcxData[firstIndex].timestamp);
        const lastDate = new Date(tcxConfig.tcxData[lastIndex].timestamp);
        document.getElementById('sliderMin').innerText = firstDate.toLocaleTimeString();
        document.getElementById('sliderMax').innerText = lastDate.toLocaleTimeString();
    }
}

/**
 * updates Chart Data to have a nice animation when we add and remove points with the slider widget
 * @param  {Node} slider - node Element which contains the slider UI
 * @param  {TCXConfig} tcxConfig - global TCX Config object
 */
function filterDataForRange(startPercent, stopPercent, tcxConfig) {
    
    if (tcxConfig !== undefined && tcxConfig.tcxData !== undefined && tcxConfig.tcxData.length > 0) {
        // Updating the labels near the slider widget
        const newStartIndex = Math.trunc(startPercent/100*(tcxConfig.tcxData.length-1));
        const newEndIdx = Math.trunc(stopPercent/100*(tcxConfig.tcxData.length-1));
        console.log(`Slider: ${startPercent}-${stopPercent} => ${newStartIndex} - ${newEndIdx} (${tcxConfig.tcxData.length} length)`);

        if (tcxConfig.startIndex < newStartIndex) {
            // then we are REMOVING data at the beginning of the range
            console.log(`Remove from ${tcxConfig.startIndex} to ${newStartIndex}`);
            tcxConfig.removeDataFromCharts(newStartIndex-tcxConfig.startIndex, 'beginning');
            tcxConfig.startIndex = newStartIndex;

        } else if (newStartIndex < tcxConfig.startIndex) {
            // then we are ADDING data at the beginnig of the range
            console.log(`Add from ${newStartIndex} to ${tcxConfig.startIndex}`)
            tcxConfig.addDataToCharts(newStartIndex, tcxConfig.startIndex-1, 'beginning');
            tcxConfig.startIndex = newStartIndex
        }

        if (newEndIdx < tcxConfig.endIndex ) {
            // We have to remove data at the end
            console.log(`Remove at the end from ${newEndIdx} to ${tcxConfig.endIndex}`);
            tcxConfig.removeDataFromCharts(tcxConfig.endIndex - newEndIdx, 'end');
            tcxConfig.endIndex = newEndIdx; 
        } else if (newEndIdx > tcxConfig.endIndex) {
            console.log(`Add at the end from ${tcxConfig.endIndex} to ${ newEndIdx}`);
            tcxConfig.addDataToCharts(tcxConfig.endIndex+1,newEndIdx,'end');
            tcxConfig.endIndex = newEndIdx;
        }


    }

}
