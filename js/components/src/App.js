'use strict'

// Configuration
let config;
try {
	config = JSON.parse(remote.require('fs').readFileSync('config.json'));

	// Default parameters
	config.track     = typeof(config.track)     == 'string' ? config.track     : '#node';
	config.count     = typeof(config.count)     == 'number' ? config.count     : 15;
	config.maxTweets = typeof(config.maxTweets) == 'number' ? config.maxTweets : 100;
} catch (error) {
	alert('config.json: ' + error);
	remote.app.quit();
}

// Twitter
const Twitter = remote.require('twitter');
let twitterClient;

// React
import React from 'react';
import ReactDOM from 'react-dom';

class App extends React.Component {
	render() {
		return (
			<div id='app'>
				<Gallery tweets={ this.state.tweets } />
			</div>
		)
	}
	maxID = -1
	state = {
		tweets: [],
		isStreaming: false,
	}
	componentDidMount() {
		twitterClient = new Twitter({
			consumer_key: config.consumer_key,
			consumer_secret: config.consumer_secret,
			access_token_key: config.access_token_key,
			access_token_secret: config.access_token_secret,
		});

		this.searchTweets();
	}
	searchTweets = () => {
		// Should never be called if we are already streaming tweets
		if (this.state.isStreaming) {
			console.error('searchTweets() was called while streaming tweets');
			return;
		}

		// Check if we reached the quota of max tweets searched, in which case we start streaming tweets
		if (this.state.tweets.length >= config.maxTweets) {
			console.log('Reached max tweets searched of', config.maxTweets);
			this.streamTweets();
			return;
		}

		// Search tweets
		let params = this.prepareTwitterParams();
		twitterClient.get('search/tweets', params, (error, data, response) => {
			if (error) {
				console.error(error);
				return;
			}

			let tweetsFound = data.statuses;

			// If tweets are found, find the smallest tweet ID and append the tweets to the current ones
			if (tweetsFound.length > 0) {
				let ids = tweetsFound.map(function(tweet) {
					return tweet.id;
				});
				this.maxID = Math.min.apply(null, ids);

				let currentTweets = this.state.tweets;
				for (let i in tweetsFound) {
					currentTweets.push(tweetsFound[i]);
				}
				this.setState({ tweets: currentTweets });
			}

			if (tweetsFound.length < config.count) {
				// If no tweets are found or we reached the end of search results, start streaming
				this.streamTweets();
			} else {
				// There may be some tweets left, keep searching
				this.searchTweets(); 
			}
		});

		console.log('Searching tweets..');
	}
	streamTweets = () => {
		// Prevent multiple streams
		if (!this.state.isStreaming) {

			twitterClient.stream('statuses/filter', {
				track: encodeURIComponent(config.track),
			}, (stream) => {
				stream.on('data', (tweet) => {
					let tweets = this.state.tweets;
					tweets.unshift(tweet);
					this.setState({ tweets: tweets });
				});

				stream.on('error', (error) => {
					console.error('error');
				});

			});

			this.setState({ isStreaming: true });

			console.log('Streaming tweets..');
		}
	}
	prepareTwitterParams = () => {
 		// Encode query before passing it to Twitter (unsure if the 'twitter' module already does this)
		let q = encodeURIComponent(config.track);

		// Make sure total tweets searched never exceeds config.maxTweets (doesn't apply for tweets from stream)
		let count = config.count;
		if (this.state.tweets.length + config.count > config.maxTweets) {
			count -= (this.state.tweets.length + config.count) - config.maxTweets;
		}
	
		let params = { q: q, count: count, include_entities: true };

		// Don't include max_id if it hasn't been known yet (usually means searchTweets() has never been called before)
		if (this.maxID) {
			// Minus 100 to prevent the same tweet to be returned again (apparently tweet IDs are incremented in steps of 100?)
			params.max_id = this.maxID - 100;
		}

		return params;
	}
}

// Currently just a dummy Gallery component
class Gallery extends React.Component {
	render() {
		return (
			<div>
				<small>Found { this.props.tweets.length } tweets</small>
				{
					this.props.tweets.map((tweet) => {
						let media = tweet.entities.media;
						let mediaURL = media ? media[0].media_url : null;
						return (
							<div key={ tweet.id }>
								{ mediaURL ? <img src={ mediaURL } /> : null }
								<div>
									<p><em>"{ tweet.text }"</em></p>
									<p><strong> { tweet.user.name }</strong></p>
								</div>
								<hr />
							</div>
						)
					})
				}
			</div>
		)
	}
}

ReactDOM.render(<App />, document.getElementById('root'));
