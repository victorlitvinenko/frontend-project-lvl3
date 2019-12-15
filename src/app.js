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
  return {
    input, form, addBtn, spinner, alert, channelsContainer, postsContainer,
  };
};

const toggleAdditionItems = (config) => {
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

const renderAdditionSection = (state) => {
  const { input, addBtn } = getDomElements();
  const { url, valid, status } = state.additionProcess;
  switch (status) {
    case 'error':
      toggleAdditionItems({ alertShow: true, spinnerShow: false, inputDisabled: false });
      break;
    case 'loading':
      toggleAdditionItems({ alertShow: false, spinnerShow: true, inputDisabled: true });
      break;
    case 'idle':
      toggleAdditionItems({ alertShow: false, spinnerShow: false, inputDisabled: false });
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
  const { channels, posts, activeChannelID } = state;
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
  const channelIndex = state.channels.findIndex((el) => el.id === id);
  const channelPosts = state.posts.filter((el) => el.id === id);
  const channel = state.channels[channelIndex];
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

const parseDom = (data) => {
  const doc = new DOMParser().parseFromString(data, 'text/xml');
  const title = doc.querySelector('channel title').textContent;
  const description = doc.querySelector('channel description').textContent;
  const id = _.uniqueId();
  const posts = doc.querySelectorAll('item');
  return {
    title, description, id, posts,
  };
};

const parsePost = (post) => {
  const postTitle = post.querySelector('title').textContent;
  const postLink = post.querySelector('link').textContent;
  const postDescription = post.querySelector('description').textContent;
  const postGuid = post.querySelector('guid').textContent;
  return {
    postTitle, postLink, postDescription, postGuid,
  };
};

const app = () => {
  const state = {
    additionProcess: {
      status: 'idle',
      url: '',
      valid: true,
      addedUrls: [],
    },
    activeChannelID: null,
    channels: [],
    posts: [],
  };

  const { input, form, channelsContainer } = getDomElements();
  channelsContainer.addEventListener('click', (e) => {
    e.preventDefault();
    const a = e.target.closest('a');
    if (a) state.activeChannelID = a.dataset.id;
  });
  input.addEventListener('input', () => {
    state.additionProcess.status = 'idle';
    state.additionProcess.url = input.value;
    const { url } = state.additionProcess;
    if (url === '') {
      state.additionProcess.valid = true;
    } else {
      state.additionProcess.valid = isURL(url) && !state.additionProcess.addedUrls.includes(url);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { url } = state.additionProcess;
    if (url === '') return;
    state.additionProcess.status = 'loading';
    const channelURL = `https://cors-anywhere.herokuapp.com/${url}`;
    axios.get(channelURL)
      .then((response) => {
        state.additionProcess.status = 'idle';
        const {
          title, description, id, posts,
        } = parseDom(response.data);
        posts.forEach((post) => {
          const {
            postTitle, postLink, postDescription, postGuid,
          } = parsePost(post);
          state.posts.push({
            id, title: postTitle, link: postLink, description: postDescription, guid: postGuid,
          });
        });
        state.additionProcess.addedUrls.push(url);
        state.channels.push({
          id, title, description, url: channelURL, status: 'idle',
        });
        state.activeChannelID = id;
        setInterval(() => {
          const channelIndex = state.channels.findIndex((el) => el.id === id);
          if (state.channels[channelIndex].status === 'loading') return;
          const start = new Promise((resolve, reject) => {
            state.channels[channelIndex].status = 'loading';
            loadNewPosts(state, id)
              .then((data) => {
                resolve(data);
              })
              .catch((error) => {
                reject(error);
              })
              .finally(() => {
                state.channels[channelIndex].status = 'idle';
              });
          });
          start
            .then((newPosts) => {
              state.posts = [...newPosts, ...state.posts];
            })
            .catch((error) => {
              console.log(error);
            });
        }, 5000);
      })
      .catch((error) => {
        state.additionProcess.status = 'error';
        console.log(error);
      })
      .finally(() => {
        state.additionProcess.url = '';
      });
  });
  WatchJS.watch(state, 'additionProcess', () => {
    renderAdditionSection(state);
  });
  WatchJS.watch(state, ['activeChannelID', 'channels', 'posts'], () => {
    renderFeeds(state);
  });
  $('#exampleModal').on('show.bs.modal', (event) => {
    const button = $(event.relatedTarget);
    const descr = button.data('descr');
    $('.modal-body div').html(_.unescape(descr));
  });
};

export default app;
