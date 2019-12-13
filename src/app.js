import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';
import _ from 'lodash';
import $ from 'jquery';

const getDomElements = () => {
  const input = document.querySelector('#input');
  const form = document.querySelector('#form');
  const addBtn = document.querySelector('#add');
  const spinner = document.querySelector('#spinner');
  const alert = document.querySelector('#alert');
  const channelsContainer = document.querySelector('#channels');
  const postsContainer = document.querySelector('#posts');
  const leftCol = document.querySelector('#leftCol');
  return {
    input, form, addBtn, spinner, alert, channelsContainer, postsContainer, leftCol,
  };
};

const toggleAddItems = (config) => {
  const { alertShow, spinnerShow, inputDisabled } = config;
  const {
    input, spinner, alert,
  } = getDomElements();
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

const renderAddField = (state) => {
  const { input, addBtn } = getDomElements();
  const { url, valid, status } = state.addProcess;
  switch (status) {
    case 'error':
      toggleAddItems({ alertShow: true, spinnerShow: false, inputDisabled: false });
      break;
    case 'loading':
      toggleAddItems({ alertShow: false, spinnerShow: true, inputDisabled: true });
      break;
    case 'idle':
      toggleAddItems({ alertShow: false, spinnerShow: false, inputDisabled: false });
      break;
    default:
      throw new Error(`Status '${status}' not found`);
  }
  input.value = url;
  addBtn.disabled = !valid || url === '' || status === 'loading';
  if (valid) {
    input.classList.remove('border', 'border-danger');
  } else {
    input.classList.add('border', 'border-danger');
  }
};

const renderFeeds = (state) => {
  const { channels, posts, activeChannelID } = state.feedProcess;
  const { channelsContainer, postsContainer } = getDomElements();
  channelsContainer.innerHTML = '';
  channels.forEach((channel) => {
    const str = `<a href="#" class="${activeChannelID === channel.id ? 'active' : ''}
      list-group-item list-group-item-action"
      data-id="${channel.id}">
      <div class="font-weight-bold">${channel.title}
      <div id="spinner" class="spinner-border spinner-border-sm ${channel.status !== 'loading' ? 'd-none' : ''}"
      role="status"></div></div><small>${channel.description}</small></a>`;
    channelsContainer.insertAdjacentHTML('afterbegin', str);
  });
  postsContainer.innerHTML = '';
  posts.filter((post) => post.id === activeChannelID).forEach((post) => {
    const str = `<li class="list-group-item">
      <div class="row">
        <div class="col my-auto"><a target="_blank" href="${post.link}">${post.title}</a></div>
        <div class="col-auto my-auto">
          <button class="btn btn-sm btn-light"
            data-toggle="modal" data-target="#exampleModal" data-descr="${_.escape(post.description)}">?</button>
        </div>
      </div></li>`;
    postsContainer.insertAdjacentHTML('beforeend', str);
  });
};

const loadNewPosts = (state, id) => {
  const channelIndex = state.feedProcess.channels.findIndex((el) => el.id === id);
  const channelPosts = state.feedProcess.posts.filter((el) => el.id === id);
  const channel = state.feedProcess.channels[channelIndex];
  return axios.get(channel.url)
    .then((response) => {
      const doc = new DOMParser().parseFromString(response.data, 'text/xml');
      const posts = doc.querySelectorAll('item');
      return [...posts].reduce((acc, post) => {
        const postGuid = post.querySelector('guid').textContent;
        if (!channelPosts.some((e) => e.guid === postGuid)) {
          const postTitle = post.querySelector('title').textContent;
          const postLink = post.querySelector('link').textContent;
          const postDescription = post.querySelector('description').textContent;
          return [...acc, {
            id: channel.id,
            title: postTitle,
            link: postLink,
            description: postDescription,
            guid: postGuid,
          }];
        }
        return acc;
      }, []);
    })
    .catch((error) => error);
};

const app = () => {
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

  const { input, form, channelsContainer } = getDomElements();
  channelsContainer.addEventListener('click', (e) => {
    e.preventDefault();
    const a = e.target.closest('a');
    if (a) state.feedProcess.activeChannelID = a.dataset.id;
  });
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
            const postDescription = post.querySelector('description').textContent;
            const postGuid = post.querySelector('guid').textContent;
            state.feedProcess.posts.push({
              id, title: postTitle, link: postLink, description: postDescription, guid: postGuid,
            });
          });
          state.addProcess.addedUrls.push(url);
          state.feedProcess.channels.push({
            id, title, description, url: channelURL, status: 'idle',
          });
          state.feedProcess.activeChannelID = id;
          setInterval(() => {
            const channelIndex = state.feedProcess.channels.findIndex((el) => el.id === id);
            const start = new Promise((resolve, reject) => {
              state.feedProcess.channels[channelIndex].status = 'loading';
              loadNewPosts(state, id)
                .then((data) => {
                  resolve(data);
                })
                .catch((error) => {
                  reject(error);
                })
                .finally(() => {
                  state.feedProcess.channels[channelIndex].status = 'idle';
                });
            });
            start
              .then((newPosts) => {
                state.feedProcess.posts = [...newPosts, ...state.feedProcess.posts];
              })
              .catch((error) => {
                console.log(error);
              });
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
    renderAddField(state);
  });
  WatchJS.watch(state, 'feedProcess', () => {
    renderFeeds(state);
  });
  $('#exampleModal').on('show.bs.modal', (event) => {
    const button = $(event.relatedTarget);
    const descr = button.data('descr');
    $('.modal-body div').html(_.unescape(descr));
  });
};

export default app;
