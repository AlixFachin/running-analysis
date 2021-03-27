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
    if (elementNode.style.display === 'block') {
        elementNode.style.display = 'none';
        elementNode.style.visibility = 'hidden';
    } else {
        elementNode
        elementNode.style.display =  'block';
        elementNode.style.visibility='visible';
    }
    
}