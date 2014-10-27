var mfuture = require('../mfuture');

var f1 = mfuture.delay(100, 'f1');
var f2 = mfuture.delay(200, 'f2');

var f12 = f1.flatMap(function() {
	return f2;
});

// f12 has later time and later value
f12.get(function(x) {
	console.log(f12.time(), x);
});

var f21 = f2.flatMap(function() {
	return f1;
});

// f21 has later time, but earlier value
f21.get(function(x) {
	console.log(f21.time(), x);
});
