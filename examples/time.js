var mfuture = require('../mfuture');

var a = [];
var n = 100;
for(var i=0; i<n; ++i) {
	a.push(mfuture.of(i).delay(i));
}

a[Math.floor(n/2)] = mfuture.of('hello');

setTimeout(function() {
	a.reduce(mfuture.earliest, mfuture.never()).map(function(s) {
		return s + ', world!';
	}).get(console.log.bind(console));
}, n*2);

