'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var inappropriateWords = ['RT', 'fuck', 'shit'];

// Configuration
var config = undefined;
try {
	config = JSON.parse(remote.require('fs').readFileSync('config.json'));

	// Default parameters
	config.track = typeof config.track == 'string' ? config.track : '#node';
	config.count = typeof config.count == 'number' ? config.count : 15;
	config.max_tweets = typeof config.max_tweets == 'number' ? config.max_tweets : 100;
} catch (error) {
	alert('config.json: ' + error);
	remote.app.quit();
}

// Twitter
var Twitter = remote.require('twitter');
var twitterClient = undefined;

// React

var App = function (_React$Component) {
	_inherits(App, _React$Component);

	function App() {
		var _Object$getPrototypeO;

		var _temp, _this, _ret;

		_classCallCheck(this, App);

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_Object$getPrototypeO = Object.getPrototypeOf(App)).call.apply(_Object$getPrototypeO, [this].concat(args))), _this), _this.maxID = -1, _this.state = {
			tweets: [],
			isStreaming: false
		}, _this.wordFilter = function (phrase) {
			var i = 0;
			while (i < inappropriateWords.length - 1) {
				if (phrase.indexOf(inappropriateWords[i]) > -1) {
					return false;
				} else {
					i++;
				}
			}
			return true;
		}, _this.searchTweets = function () {
			// Should never be called if we are already streaming tweets
			if (_this.state.isStreaming) {
				console.error('searchTweets() was called while streaming tweets');
				return;
			}

			// Check if we reached the quota of max tweets searched, in which case we start streaming tweets
			if (_this.state.tweets.length >= config.max_tweets) {
				console.log('Reached max tweets searched of', config.max_tweets);
				_this.streamTweets();
				return;
			}

			// Search tweets
			var params = _this.prepareTwitterParams();
			twitterClient.get('search/tweets', params, function (error, data, response) {
				if (error) {
					console.error(error);
					return;
				}

				var tweetsFound = data.statuses;

				// If tweets are found, find the smallest tweet ID and append the tweets to the current ones.
				// The smallest tweet ID is needed for next search.
				if (tweetsFound.length > 0) {
					var ids = tweetsFound.map(function (tweet) {
						return tweet.id;
					});
					_this.maxID = Math.min.apply(null, ids);

					var currentTweets = _this.state.tweets;
					for (var i in tweetsFound) {
						if (_this.wordFilter(tweetsFound[i].text)) {
							currentTweets.push(tweetsFound[i]);
						} else {
							console.log(tweetsFound[i].text);
						}
					}
					_this.setState({ tweets: currentTweets });
				}

				if (tweetsFound.length < config.count) {
					// If no tweets are found or we reached the end of search results, start streaming
					_this.streamTweets();
				} else {
					// There may be some tweets left, keep searching
					_this.searchTweets();
				}
			});

			console.log('Searching tweets..');
		}, _this.streamTweets = function () {
			console.log('hello stream');
			// Prevent multiple streams
			if (!_this.state.isStreaming) {

				twitterClient.stream('statuses/filter', {
					track: encodeURIComponent(config.track)
				}, function (stream) {
					stream.on('data', function (tweet) {
						var tweets = _this.state.tweets;
						tweets.unshift(tweet);
						_this.setState({ tweets: tweets });
					});

					stream.on('error', function (error) {
						console.error('error');
					});
				});

				_this.setState({ isStreaming: true });

				console.log('Streaming tweets..');
			}
		}, _this.prepareTwitterParams = function () {
			// Encode query before passing it to Twitter (unsure if the 'twitter' module already does this)
			var q = encodeURIComponent(config.track);

			// Make sure total tweets searched never exceeds config.max_tweets (doesn't apply for tweets from stream)
			var count = config.count;
			if (_this.state.tweets.length + config.count > config.max_tweets) {
				count -= _this.state.tweets.length + config.count - config.max_tweets;
			}

			var params = { q: q, count: count, include_entities: true };

			// Don't include max_id if it hasn't been known yet (usually means searchTweets() has never been called before)
			if (_this.maxID) {
				// Minus 100 to prevent the same tweet to be returned again (apparently tweet IDs are incremented in steps of 100?)
				params.max_id = _this.maxID - 100;
			}

			return params;
		}, _temp), _possibleConstructorReturn(_this, _ret);
	}

	_createClass(App, [{
		key: 'render',
		value: function render() {
			return _react2.default.createElement(
				'div',
				{ id: 'app' },
				_react2.default.createElement(Gallery, { tweets: this.state.tweets })
			);
		}
	}, {
		key: 'componentDidMount',
		value: function componentDidMount() {
			twitterClient = new Twitter({
				consumer_key: config.consumer_key,
				consumer_secret: config.consumer_secret,
				access_token_key: config.access_token_key,
				access_token_secret: config.access_token_secret
			});

			this.searchTweets();
		}
	}]);

	return App;
}(_react2.default.Component);

// Currently just a dummy Gallery component


var Gallery = function (_React$Component2) {
	_inherits(Gallery, _React$Component2);

	function Gallery() {
		_classCallCheck(this, Gallery);

		return _possibleConstructorReturn(this, Object.getPrototypeOf(Gallery).apply(this, arguments));
	}

	_createClass(Gallery, [{
		key: 'render',
		value: function render() {
			return _react2.default.createElement(
				'div',
				null,
				_react2.default.createElement(
					'small',
					null,
					'Found ',
					this.props.tweets.length,
					' tweets'
				),
				this.props.tweets.map(function (tweet) {
					var media = tweet.entities.media;
					var mediaURL = media ? media[0].media_url : null;
					return _react2.default.createElement(
						'div',
						{ key: tweet.id },
						_react2.default.createElement(
							'div',
							{ className: 'tweet_block' },
							_react2.default.createElement(
								'p',
								null,
								_react2.default.createElement(
									'em',
									null,
									'"',
									tweet.text,
									'"'
								)
							),
							_react2.default.createElement(
								'p',
								null,
								_react2.default.createElement(
									'strong',
									null,
									' - ',
									tweet.user.name
								)
							)
						)
					);
				})
			);
		}
	}]);

	return Gallery;
}(_react2.default.Component);

_reactDom2.default.render(_react2.default.createElement(App, null), document.getElementById('root'));