var mfuture = require('../mfuture');

var future = mfuture.create(function(value) {
	setTimeout(function() {
		value.error(new Error('hello'));
	}, 100);
});

future.catch(function(e) {
	return e.message + ', world!';
}).get(console.log.bind(console));