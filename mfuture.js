exports.create   = create;
exports.never    = never;
exports.of       = of;
exports.map      = map;
exports.join     = join;
exports.flatMap  = flatMap;
exports.get      = get;
exports.earliest = earliest;
exports.catch    = exports.catchError = catchError;

// Create a future by executing a function that will eventually
// provide its value
function create(f) {
	var pending = new Pending();

	try {
		f(set, err);
	} catch(e) {
		err(e);
	}

	function set(x) { become(new Fulfilled(x), pending); }
	function err(x) { become(new Failed(x), pending); }

	return pending;
}

// Create a future with value x
function of(x) {
	return new Fulfilled(x);
}

// Return a new future whose value has been transformed by f
function map(f, future) {
	return future.when(f);
}

// Turn a future future value into a future value
function join(future) {
	return future.join();
}

// Transform future's value into a new future
function flatMap(f, future) {
	return map(f, future).join();
}

// Recover from a failed future
function catchError(f, future) {
	return future.when(null, f);
}

// Execute f with the value of a future when it becomes available
// If future fails, get will throw an uncatchable error
// Does not return a new future.
function get(f, future) {
	future.when(f, fail);
}

// Delay a future
function delay(dt, future) {
	return flatMap(function(x) {
		return create(function (set) {
			setTimeout(set, dt, x);
		});
	}, future);
}

// Choose the earliest of two futures, based on their time
function earliest(a, b) {
	var at = a.time();
	var bt = b.time();

	if(at < bt) {
		return a;
	} else if(bt < at) {
		return b;
	}

	return create(function(set, err) {
		a.when(set, err);
		b.when(set, err);
	});
}

// Throw an uncatchable error
function fail(e) {
	setTimeout(function() { throw e; }, 0);
}

// Time
var currentTime = 0;
function now() {
	return currentTime++;
}

function maxTime() {
	return Infinity;
}

// Future prototype
var future = {
	map:     function(f)  { return map(f, this); },
	flatMap: function(f)  { return flatMap(f, this); },
	catch:   function(f)  { return catchError(f, this); },
	get:     function(f)  { return get(f, this); },
	join:    function()   { return this.value.when(); },
	time:    function()   { return this.at; },
	delay:   function(dt) { return delay(dt, this); }
};

// Future that will never acquire a value
function Never() {}

Never.prototype = Object.create(future);
Never.prototype.when = Never.prototype.join = never;
Never.prototype.time = maxTime;

// Never singleton
var _never = new Never();
function never() {
	return _never;
}

// Future whose value is available immediately
function Fulfilled(x) {
	this.at = now();
	this.value = x;
}

Fulfilled.prototype = Object.create(future);

Fulfilled.prototype.when = function(f) {
	return typeof f !== 'function' ? new Fulfilled(this.value)
		: mapFuture(f, this.value);
};

// Future that has failed to produce a value
function Failed(e) {
	this.at = now();
	this.value = e;
}

Failed.prototype = Object.create(future);

Failed.prototype.when = function(f, r) {
	return typeof r !== 'function' ? new Failed(this.value)
		: mapFuture(r, this.value);
};

// Future whose fate is not yet revealed
function Pending() {
	this.value = never();
	this.resolved = false;
	this.queue = [];
}

Pending.prototype = Object.create(future);

Pending.prototype.when = function(f, r) {
	if (this.resolved) {
		return this.value.when(f, r);
	}

	var p = new Pending();
	this.queue.push(new Map(f, r, p));
	return p;
};

Pending.prototype.join = function() {
	if (this.resolved) {
		return this.value.join();
	}

	var p = new Pending();
	this.queue.push(new Join(p));
	return p;
};

Pending.prototype.time = function() {
	return this.value.time();
};

function become(x, pending) {
	if(pending.resolved) {
		throw new Error('Future value already set');
	}

	pending.resolved = true;
	pending.value = x;
	resolve(pending.queue, x);
}

function mapFuture(f, x) {
	try {
		return new Fulfilled(f(x));
	} catch(e) {
		return new Failed(e);
	}
}

function resolve(q, x) {
	for(var i=0; i<q.length; ++i) {
		q[i].resolve(x);
	}
}

function Map(f, r, p) {
	this.f = f; this.r = r; this.p = p;
}

Map.prototype.resolve = function(x) {
	become(x.when(this.f, this.r), this.p);
};

function Join(p) {
	this.p = p;
}

Join.prototype.resolve = function(x) {
	become(x.join(), this.p);
};
