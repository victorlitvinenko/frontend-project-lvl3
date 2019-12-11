import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';
import _ from 'lodash';
import $ from 'jquery';

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

const setActiveChannel = (id) => {
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
      setActiveChannel(channel.id);
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
    const str = `<li class="list-group-item">
      <div class="row">
        <div class="col my-auto"><a target="_blank" href="${post.link}">${post.title}</a></div>
        <div class="col-auto my-auto">
          <button class="btn btn-sm btn-light"
            data-toggle="modal" data-target="#exampleModal" data-descr="${_.escape(post.description)}">?</button>
        </div>
      </div></li>`;
    postsUl.insertAdjacentHTML('beforeend', str);
  });
  channelsContainer.replaceWith(channelsUl);
  postsContainer.replaceWith(postsUl);
};

const loadNewFeeds = (id) => {
  const channelIndex = state.feedProcess.channels.findIndex((el) => el.id === id);
  const channelPosts = state.feedProcess.posts.filter((el) => el.id === id);
  const channel = state.feedProcess.channels[channelIndex];
  state.feedProcess.channels[channelIndex].status = 'loading';
  axios.get(channel.url)
    .then((response) => {
      const doc = new DOMParser().parseFromString(response.data, 'text/xml');
      const posts = doc.querySelectorAll('item');
      const newPosts = [];
      posts.forEach((post) => {
        const postGuid = post.querySelector('guid').textContent;
        if (!channelPosts.some((e) => e.guid === postGuid)) {
          const postTitle = post.querySelector('title').textContent;
          const postLink = post.querySelector('link').textContent;
          const postDescription = post.querySelector('description').textContent;
          newPosts.push({
            id: channel.id,
            title: postTitle,
            link: postLink,
            description: postDescription,
            guid: postGuid,
          });
        }
      });
      state.feedProcess.posts = [...newPosts, ...state.feedProcess.posts];
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
          console.log(doc);
          const title = doc.querySelector('channel title').textContent;
          const description = doc.querySelector('channel description').textContent;
          const id = _.uniqueId();
          const posts = doc.querySelectorAll('item');
          posts.forEach((post) => {
            const postTitle = post.querySelector('title').textContent;
            const postLink = post.querySelector('link').textContent;
            const postDescription = post.querySelector('description').textContent;
            const postGuid = post.querySelector('guid').textContent;
            state.feedProcess.posts.push({
              id, title: postTitle, link: postLink, description: postDescription, guid: postGuid,
            });
          });
          state.addProcess.addedUrls.push(url);
          state.feedProcess.channels.push({
            id, title, description, url: channelURL, status: '',
          });
          state.feedProcess.activeChannelID = id;
          setInterval(() => {
            loadNewFeeds(id);
          }, 5000);
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
  $('#exampleModal').on('show.bs.modal', (event) => {
    const button = $(event.relatedTarget);
    const descr = button.data('descr');
    $('.modal-body div').html(_.unescape(descr));
  });
};

export default app;
