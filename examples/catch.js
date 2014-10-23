var mfuture = require('../mfuture');

var future = mfuture.create(function(set, err) {
	setTimeout(function() {
		err(new Error('hello'));
	}, 100);
});

future.catch(function(e) {
	return e.message + ', world!';
}).get(console.log.bind(console));