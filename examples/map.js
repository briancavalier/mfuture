var mfuture = require('../mfuture');

var future = mfuture.create(function(set) {
	setTimeout(function() {
		set('hello');
	}, 100);
});

future.map(function(s) {
	return s + ', world!';
}).get(console.log.bind(console));