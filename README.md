# Overview

This project started as a test case for getting myself familiar with the [chart.js](https://www.chartjs.org/) library.

# How to install
Currently you need to download all the files (for example, by cloning the repo) and open the `TCXAnalyzer.html` file in your browser.

# How does it work
First, you need a `.TCX` file. If you have an account with GARMIN Connect, you can use the `export to TCX` feature when you select an activity.
(In a future version I would like to add a feature to _download from STRAVA_.)

When you import the file, you can choose the metric displayed on each chart, and the slider enables you to restrict the data interval range. (For example, if you want to remove the first 15 minutes from the plot as you were warming up during this interval).

# Known bugs

- The javascript doens't work for Safari browser.

# Next features

- Incorporation of BABEL library to make the code palatable to all browsers and non-EM6 syntax
- Access to GARMIN or STRAVA API instead of TCX file upload
- More data filtering and data manipulation


