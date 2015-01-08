exports.create   = create;
exports.never    = never;
exports.of       = of;
exports.delay    = delayed;
exports.map      = map;
exports.ap       = ap;
exports.join     = join;
exports.flatMap  = flatMap;
exports.get      = get;
exports.earliest = earliest;
exports.catch    = exports.catchError = catchError;
exports.throw    = exports.throwError = throwError;

// --------------------------------------------------------------
// Create

// Create a future by executing a function that will eventually
// provide its value
function create(f) {
	var pending = new Future();

	try {
		f(set, err);
	} catch(e) {
		err(e);
	}

	function set(x) { become(new Fulfilled(now(), x), pending); }
	function err(x) { become(new Failed(now(), x), pending); }

	return pending;
}

// Create a future with value x
function of(x) {
	return new Fulfilled(minTime(), x);
}

// --------------------------------------------------------------
// Transform

// Return a new future whose value has been transformed by f
function map(f, future) {
	return future.map(f);
}

// Turn a future future value into a future value
function join(future) {
	return future.join();
}

// Transform future's value into a new future
function flatMap(f, future) {
	return future.flatMap(f);
}

// Apply a future function to a future x to get a future y
function ap(ff, fx) {
	return ff.ap(fx);
}

// --------------------------------------------------------------
// Get value

// Execute f with the value of a future when it becomes available
// If future fails, get will throw an uncatchable error
// Does not return a new future.
function get(f, future) {
	future.get(f);
}

// --------------------------------------------------------------
// Time

// Create a future that reveals its value x only after a delay
function delayed(dt, x) {
	return create(function (set) {
		timer(set, dt, x);
	});
}

// Delay an existing future
function delay(dt, future) {
	return future.flatMap(function(x) {
		return delayed(dt, x);
	});
}

// Choose the earliest of two futures, based on their time
function earliest(a, b) {
	var at = a.time();
	var bt = b.time();

	return at < bt ? a
	     : bt < at ? b
	     : awaitEarliest(a, b);
}

function awaitEarliest(a, b) {
	var p = new Future();

	a.when(becomea, becomea);
	b.when(becomeb, becomeb);

	return p;

	function becomea() { become(a, p); }
	function becomeb() { become(b, p); }
}

// --------------------------------------------------------------
// Errors

// Recover from a failed future
function catchError(f, future) {
	return future.catch(f);
}

// Create a failed future
function throwError(e) {
	return new Failed(minTime(), e);
}

// Throw an uncatchable error
function fail(e) {
	timer(rethrow, 0, e);
}

function rethrow(e) {
	throw e;
}

// --------------------------------------------------------------
// Time

// Use a counter rather than wall-clock time, since all
// we really need is ordering, not actual time
var currentTime = 0;
function now() {
	return ++currentTime;
}

function maxTime() {
	return Infinity;
}

function minTime() {
	return 0;
}

function timer(f, t, x) {
	return setTimeout(f, t, x);
}

// --------------------------------------------------------------
// Never

// Future that will never acquire a value
var _never = Object.create(Future.prototype);
_never.when
    = _never.catch
    = _never.map
    = _never.ap
    = _never.join
    = _never.flatMap
	= _never.delay
    = never;
_never.time = maxTime;

// Never singleton
function never() {
	return _never;
}

// --------------------------------------------------------------
// Fulfilled

// Future whose value is available immediately
function Fulfilled(t, x) {
	this.at = t;
	this.value = x;
}

Fulfilled.prototype.time = function() {
	return this.at;
}

Fulfilled.prototype.get = function(f) {
    this.map(f).catch(fail);
};

Fulfilled.prototype.when = function(f) {
    return this.map(f);
};

Fulfilled.prototype.map = function(f) {
    return mapFuture(f, this.at, this.value);
};

Fulfilled.prototype.ap = function(x) {
    return x.map(this.value);
};

Fulfilled.prototype.join = function(f) {
    return this.value;
};

Fulfilled.prototype.flatMap = function(f) {
	return f(this.value);
};

Fulfilled.prototype.delay = function(dt) {
	return delayed(dt, this.value);
};

Fulfilled.prototype.catch = returnThis;

// --------------------------------------------------------------
// Failed

// Future that has failed to produce a value
function Failed(t, e) {
	this.at = t;
	this.value = e;
}

Failed.prototype = Object.create(Future.prototype);

Failed.prototype.time = function() {
	return this.at;
}

Failed.prototype.get = function(f) {
    fail(this.value);
};

Failed.prototype.when = function(f, r) {
    return this.catch(r);
};

Failed.prototype.catch = function(r) {
	return mapFuture(r, this.at, this.value);
};

Failed.prototype.map
	= Failed.prototype.ap
	= Failed.prototype.join
	= Failed.prototype.flatMap
	= returnThis;

// --------------------------------------------------------------
// Future

// Future whose time and value cannot be known until later
function Future() {
	this.value = never();
	this.queue = [];
}

Future.prototype.map = function(f)  {
	return this.when(f, rethrow);
};

Future.prototype.ap = function(x)  {
	return this.flatMap(function(f) {
		return x.map(f);
	});
};

Future.prototype.get = function(f)  {
	this.when(f).catch(fail);
};

Future.prototype.delay = function(dt) {
	return this.flatMap(function(x) {
		return delayed(dt, x);
	});
};

Future.prototype.catch   = function(f)  {
	return this.when(identity, f);
};

Future.prototype.flatMap = function(f)  {
	if (hasArrived(this)) {
		return this.value.flatMap(f);
	}

	var p = new Future();
	this.queue.push(new FlatMap(f, p));
	return p;
};

Future.prototype.when = function(f, r) {
	if (hasArrived(this)) {
		return this.value.when(f, r);
	}

	var p = new Future();
	this.queue.push(new Map(f, r, p));
	return p;
};

Future.prototype.join = function() {
	return this.flatMap(identity);
};

Future.prototype.time = function() {
	return this.value.time();
};

// Assign the state of future to target. Throws if pending
// already has a value.
// target must be a Future, value can be any future
function become(value, target) {
	if(hasArrived(target)) {
		throw new Error('Future value already set');
	}

	target.value = value;
	target.queue = resolve(target.queue, value);
}

// Returns true if Future f has arrived (thus its time and
// value can be known)
function hasArrived(f) {
	return f.time() < maxTime();
}

// --------------------------------------------------------------
// Helpers

// Try to map a value to a future
function mapFuture(f, t, x) {
	try {
		return new Fulfilled(t, f(x));
	} catch(e) {
		return new Failed(t, e);
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

function FlatMap(f, p) {
	this.f = f;
	this.p = p;
}

FlatMap.prototype.resolve = function(x) {
	var f = this.f;
	var xj = x.flatMap(f);
	var value = xj.flatMap(function(xv) {
		return new Fulfilled(Math.max(x.time(), xj.time()), xv);
	});

	become(value, this.p);
};

function returnThis() { return this; }

function identity(x) { return x; }