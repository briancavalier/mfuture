var mfuture = require('../mfuture');

var future = mfuture.create(function(set) {
	setTimeout(function() {
		set('hello');
	}, 100);
});

future.flatMap(function(s) {
	return mfuture.create(function(set) {
		setTimeout(function() {
			set(s + ', world!');
		}, 100);
	});
}).get(console.log.bind(console));