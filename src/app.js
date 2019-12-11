import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';
import _ from 'lodash';

const state = {
  addProcess: {
    status: 'idle',
    url: '',
    valid: true,
    addedUrls: [],
  },
  feedProcess: {
    activeChannelID: null,
    channels: [],
    posts: [],
  },
};

const getDOMElements = () => {
  const input = document.querySelector('#input');
  const form = document.querySelector('#form');
  const addBtn = document.querySelector('#add');
  const spinner = document.querySelector('#spinner');
  const alert = document.querySelector('#alert');
  const channelsContainer = document.querySelector('#channels');
  const postsContainer = document.querySelector('#posts');
  return {
    input, form, addBtn, spinner, alert, channelsContainer, postsContainer,
  };
};

const toggleAddItems = (config) => {
  const { alertShow, spinnerShow, inputDisabled } = config;
  const {
    input, spinner, alert,
  } = getDOMElements();
  if (alertShow) {
    alert.classList.remove('d-none');
  } else {
    alert.classList.add('d-none');
  }
  if (spinnerShow) {
    spinner.classList.remove('d-none');
  } else {
    spinner.classList.add('d-none');
  }
  input.disabled = inputDisabled;
};

const renderAddField = () => {
  const { input, addBtn } = getDOMElements();
  const { url, valid, status } = state.addProcess;
  switch (status) {
    case 'error':
      toggleAddItems({ alertShow: true, spinnerShow: false, inputDisabled: false });
      break;
    case 'loading':
      toggleAddItems({ alertShow: false, spinnerShow: true, inputDisabled: true });
      break;
    default:
      toggleAddItems({ alertShow: false, spinnerShow: false, inputDisabled: false });
  }
  input.value = url;
  addBtn.disabled = !valid || url === '' || status === 'loading';
  if (valid) {
    input.classList.remove('border', 'border-danger');
  } else {
    input.classList.add('border', 'border-danger');
  }
};

const setActiveFeed = (id) => {
  state.feedProcess.activeChannelID = id;
};

const renderFeeds = () => {
  const { channels, posts, activeChannelID } = state.feedProcess;
  const { channelsContainer, postsContainer } = getDOMElements();
  const channelsUl = document.createElement('ul');
  channelsUl.id = 'channels';
  channelsUl.classList.add('list-group');
  channels.forEach((channel) => {
    const a = document.createElement('a');
    a.classList.add('list-group-item', 'list-group-item-action');
    if (activeChannelID === channel.id) a.classList.add('active');
    a.href = '#';
    a.onclick = (e) => {
      e.preventDefault();
      setActiveFeed(channel.id);
    };
    a.innerHTML = `<div class="font-weight-bold">${channel.title}
    <div id="spinner" class="spinner-border spinner-border-sm ${channel.status !== 'loading' ? 'd-none' : ''}"
      role="status"></div></div><small>${channel.description}</small>`;
    channelsUl.prepend(a);
  });
  const postsUl = document.createElement('ul');
  postsUl.id = 'posts';
  postsUl.classList.add('list-group');
  posts.filter((post) => post.id === activeChannelID).forEach((post) => {
    const str = `<li class="list-group-item"><a target="_blank" href="${post.link}">${post.title}</a></li>`;
    postsUl.insertAdjacentHTML('beforeend', str);
  });
  channelsContainer.replaceWith(channelsUl);
  postsContainer.replaceWith(postsUl);
};

const loadFeeds = (id) => {
  // const channel = state.feedProcess.channels.find((el) => el.id === id);
  const channelIndex = state.feedProcess.channels.findIndex((el) => el.id === id);
  const channel = state.feedProcess.channels[channelIndex];
  state.feedProcess.channels[channelIndex].status = 'loading';
  axios.get(channel.url)
    .then((response) => {
      const doc = new DOMParser().parseFromString(response.data, 'text/xml');
      const posts = doc.querySelectorAll('item');
      const newPosts = [];
      const otherPosts = state.feedProcess.posts.filter((post) => post.id !== id);
      posts.forEach((post) => {
        const postTitle = post.querySelector('title').textContent;
        const postLink = post.querySelector('link').textContent;
        newPosts.push({ id: channel.id, title: postTitle, link: postLink });
      });
      state.feedProcess.posts = [...otherPosts, ...newPosts];
    })
    .catch((error) => {
      console.log(error);
    })
    .finally(() => {
      state.feedProcess.channels[channelIndex].status = '';
    });
};

const app = () => {
  const { input, form } = getDOMElements();
  input.addEventListener('input', () => {
    state.addProcess.status = 'idle';
    state.addProcess.url = input.value;
    const { url } = state.addProcess;
    if (url === '') {
      state.addProcess.valid = true;
    } else {
      state.addProcess.valid = isURL(url) && !state.addProcess.addedUrls.includes(url);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { url } = state.addProcess;
    if (url !== '') {
      state.addProcess.status = 'loading';
      const channelURL = `https://cors-anywhere.herokuapp.com/${url}`;
      axios.get(channelURL)
        .then((response) => {
          state.addProcess.status = 'idle';
          const doc = new DOMParser().parseFromString(response.data, 'text/xml');
          const title = doc.querySelector('channel title').textContent;
          const description = doc.querySelector('channel description').textContent;
          const id = _.uniqueId();
          const posts = doc.querySelectorAll('item');
          posts.forEach((post) => {
            const postTitle = post.querySelector('title').textContent;
            const postLink = post.querySelector('link').textContent;
            state.feedProcess.posts.push({ id, title: postTitle, link: postLink });
          });
          state.addProcess.addedUrls.push(url);
          state.feedProcess.channels.push({
            id, title, description, url: channelURL, status: '',
          });
          state.feedProcess.activeChannelID = id;
          setInterval(() => {
            loadFeeds(id);
          }, 15000);
        })
        .catch((error) => {
          state.addProcess.status = 'error';
          console.log(error);
        })
        .finally(() => {
          state.addProcess.url = '';
        });
    }
  });
  WatchJS.watch(state, 'addProcess', () => {
    renderAddField();
  });
  WatchJS.watch(state, 'feedProcess', () => {
    renderFeeds();
  });
};

export default app;
