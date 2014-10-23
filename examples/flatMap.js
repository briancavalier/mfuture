var mfuture = require('../mfuture');

var future = mfuture.create(function(value) {
	setTimeout(function() {
		value.set('hello');
	}, 100);
});

future.flatMap(function(s) {
	return mfuture.create(function(value) {
		setTimeout(function() {
			value.set(s + ', world!');
		}, 100);
	});
}).get(console.log.bind(console));