// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/**
 * Returns a XMLParser function according to the current browser configuration 
 */
function getXMLParser() {
    let parseXml;

    if (typeof window.DOMParser != "undefined") {
        parseXml = function(xmlStr) {
            return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
        };
    } else if (typeof window.ActiveXObject != "undefined" &&
           new window.ActiveXObject("Microsoft.XMLDOM")) {
        parseXml = function(xmlStr) {
            var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(xmlStr);
            return xmlDoc;
        };
    } else {
        throw new Error("No XML parser found");
    }

    return parseXml;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
/* HTML Helper functions */
/**
 * Function will look into the DOM for all input elements of the parameter radioGroup, and returns the corresponding value
 * @param  {string} radioGroupName - string containing the name property of the radio group
 * @returns {string} - value attribute of the radio element selected
 */
function getRadioValue(radioGroupName) {
    const radioGroup = document.querySelectorAll(`input[name=${radioGroupName}]`);
    for (let i=0; i<radioGroup.length; i++) {
        if (radioGroup[i].checked) {
            return radioGroup[i].value;
        }
    }
    return undefined;
}
/**
 * function which toggles visible/invisible an element by changing the display and visibility properties
 * @param  {string} elementID - the ID of the DOM element of which the visibility/display will be toggled
 */
function showHideElement(elementID) {
    const elementNode = document.querySelector(`#${elementID}`);
    if (elementNode.style.visibility === 'hidden') {
        elementNode.style.display = 'block';
        elementNode.style.visibility = 'visible';
    } else {
        elementNode.style.display = 'none';
        elementNode.style.visibility = 'hidden';
    }

}
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
        this.stopIndex = 100;
        this.chartList = {}
        this.xmlParser = getXMLParser();
    }

    resetConfig() {
        this.tcxData = [];
        this.startIndex = 0;
        this.stopIndex = 100;
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

    addChart(context, xAxis, yAxis, chartType) {
        const newChart = new ActivityChartData(context, xAxis, yAxis, chartType);
        this.chartList[context.canvas.id] = newChart;
        newChart.chartObj = createNewChart(context, this.tcxData, xAxis, yAxis, chartType);
    }

    parseXMLData(textContent) {
        const xmlDocumentTree = this.xmlParser(textContent);
        parseXMLTreeAndFillArray(xmlDocumentTree,this.tcxData);
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
    
    static keyProperties = {
        'ns3:Speed' : 'speed',
        'LatitudeDegrees' : 'lat',
        'LongitudeDegrees' : 'long',
        'Time' : 'timestamp',
        'AltitudeMeters' : 'altitude',
        'DistanceMeters' : 'distance',
        'HeartRateBpm' : 'hr',
    }

    constructor(xml) {
        if (xml.nodeType !== 1 || xml.nodeName !== 'Trackpoint' ) {
            // Should maybe raise an error there
            console.error('Wrong XML node passed to Trackpoint conversion!')
            return;
        }
        this.setProperties(xml);
     }

    /**
     * Looks at the current XML node and its children and adds the datapoint properties to the current data point
     * @param  {xmlNode} xml - the XML Element on which to apply this function
     */
    setProperties(xml) {
        if (xml.nodeType === 1 && Trackpoint.keyProperties[xml.nodeName]) {
            const propertyName = Trackpoint.keyProperties[xml.nodeName];
            this[propertyName] = xml.textContent.trim();
        }
        for (let i=0; i< xml.childElementCount; i++) {
            this.setProperties(xml.children[i]);
        }
    }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
/**
 * browse the XML tree given in parameter and fills the dataArray step by step
 * @param  {xmlNode} xml - XML node, initially given by a file XML parser
 * @param  {array} dataArray=[] - array in which will be added all the activity points
 */
function parseXMLTreeAndFillArray(xml, dataArray=[]) {
    
    if (xml.nodeType === 1 && xml.nodeName === 'Trackpoint') {
        const tp = new Trackpoint(xml);
        dataArray.push(tp);
    } else {
        for (let i=0; i < xml.childElementCount; i++) {
            parseXMLTreeAndFillArray(xml.children[i], dataArray);
        }
    }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CHART-RELATED ROUTINES
/**
 * function which looks at all the Chart instances and returns the Chart.js contained in the context
 * @param  {2Dcontext} context - the context which contains the Chart.js object
 */
function getChart(context) {
    
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
 * @param  {Chart JS context} context - contains information about the current data point, see Chart.js documentation.
 * @see {@link https://www.chartjs.org/docs/latest/general/options.html | JS Chart documentation}
 */
function gradientColor(context) {
    var index = context.dataIndex;
    var totalNumber = context.dataset.data.length;
    return `hsl(30,${Math.trunc(index/totalNumber*100)}%,50%)`    
}

/**
 * Creates the chart.js objects while defining all the options
 * @param  {2DContext} context - 2DContext which points to the canvas where the Chart will be added
 * @param  {TrackPoint table} dataTable - 
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
 * @param  {array of TCXPoint} dataArray - array of TCX points
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

    return dataArray.filter( (_unused,index) => ((index >= startIndex) && (index <= (endIndex || dataArray.length  ) )))
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
        const firstIndex = Math.trunc(start/100*trackConfig.trackData.length);
        const lastIndex = Math.trunc(stop/100*trackConfig.trackData.length);
        const firstDate = new Date(trackConfig.trackData[firstIndex].timestamp);
        const lastDate = new Date(trackConfig.trackData[lastIndex].timestamp);
        document.getElementById('sliderMin').innerText = firstDate.toLocaleTimeString();
        document.getElementById('sliderMax').innerText = lastDate.toLocaleTimeString();
    }
}

function removeChartData(ctx, length, location='beginning') {
    const myChart = getChart(ctx);
    if (location === 'beginning') {
        myChart.data.datasets[0].data.splice(0,length);
    } else {
        myChart.data.datasets[0].data.splice(-length,length);
    }
    myChart.update();
}

function addChartData(ctx,length, location='beginning') {
    const myChart = getChart(ctx);


}

/**
 * updates Chart Data to have a nice animation when we add and remove points with the slider widget
 * @param  {Node} slider - node Element which contains the slider UI
 * @param  {TCXConfig} trackConfig - global TCX Config object
 */
function filterDataForRange(slider, tcxConfig) {
    const [start, stop] = slider.noUiSlider.get();

    if (tcxConfig !== undefined && tcxConfig.tcxData !== undefined && tcxConfig.tcxData.length > 0) {
        // Updating the labels near the slider widget
        const newStartIndex = Math.trunc(start/100*tcxConfig.tcxData.length);
        const newEndIdx = Math.trunc(stop/100*tcxConfig.tcxData.length);
       
        if (tcxConfig.startIndex < newStartIndex) {
            // then we are REMOVING data at the beginning of the range
            console.log(`Remove from ${tcxConfig.startIndex} to ${newStartIndex}`)
            removeChartData(tcxConfig.ctx_ts,newStartIndex-tcxConfig.startIndex,'beginning');
            removeChartData(tcxConfig.ctx_xy,newStartIndex-tcxConfig.startIndex,'beginning');
            tcxConfig.startIndex = newStartIndex;

        } else if (newStartIndex < tcxConfig.startIndex) {
            // then we are ADDING data at the beginnig of the range
            console.log(`Add from ${newStartIndex} to ${tcxConfig.startIndex}`)


        }


    }

}
