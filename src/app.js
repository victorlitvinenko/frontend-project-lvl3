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
  const {
    showAlert, showSpinner, inputDisabled, addBtnDisabled,
  } = config;
  const {
    input, spinner, alert, addBtn,
  } = getDomElements();
  if (showAlert) {
    alert.classList.remove('d-none');
  } else {
    alert.classList.add('d-none');
  }
  if (showSpinner) {
    spinner.classList.remove('d-none');
  } else {
    spinner.classList.add('d-none');
  }
  input.disabled = inputDisabled;
  addBtn.disabled = addBtnDisabled;
};

const renderAdditionSection = (state) => {
  const { input } = getDomElements();
  const { url, valid, status } = state.additionProcess;
  input.value = url;
  switch (status) {
    case 'error':
      toggleAdditionItems({
        showAlert: true, showSpinner: false, inputDisabled: false, addBtnDisabled: true,
      });
      break;
    case 'loading':
      toggleAdditionItems({
        showAlert: false, showSpinner: true, inputDisabled: true, addBtnDisabled: true,
      });
      break;
    case 'idle':
      toggleAdditionItems({
        showAlert: false, showSpinner: false, inputDisabled: false, addBtnDisabled: !valid,
      });
      break;
    case 'empty':
      toggleAdditionItems({
        showAlert: false, showSpinner: false, inputDisabled: false, addBtnDisabled: true,
      });
      break;
    default:
      throw new Error(`Status '${status}' not found`);
  }
  if (valid) {
    input.classList.remove('border', 'border-danger');
  } else {
    input.classList.add('border', 'border-danger');
  }
};

const renderFeeds = (state) => {
  const { channels, posts, activeChannelId } = state;
  const { channelsContainer, postsContainer } = getDomElements();
  channelsContainer.innerHTML = '';
  channels.forEach((channel) => {
    const str = `<a href="#" class="${activeChannelId === channel.id ? 'active' : ''}
      list-group-item list-group-item-action"
      data-id="${channel.id}">
      <div class="font-weight-bold">${channel.title}
      <div id="spinner" class="spinner-border spinner-border-sm ${channel.status !== 'loading' ? 'd-none' : ''}"
      role="status"></div></div><small>${channel.description}</small></a>`;
    channelsContainer.insertAdjacentHTML('afterbegin', str);
  });
  postsContainer.innerHTML = '';
  posts.filter((post) => post.id === activeChannelId).forEach((post) => {
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

const parse = (data) => {
  const doc = new DOMParser().parseFromString(data, 'text/xml');
  const title = doc.querySelector('channel title').textContent;
  const description = doc.querySelector('channel description').textContent;
  const id = _.uniqueId();
  const postsElements = doc.querySelectorAll('item');
  const posts = [...postsElements].map((post) => {
    const postTitle = post.querySelector('title').textContent;
    const postLink = post.querySelector('link').textContent;
    const postDescription = post.querySelector('description').textContent;
    const postGuid = post.querySelector('guid').textContent;
    return {
      postTitle, postLink, postDescription, postGuid,
    };
  });
  return {
    id, title, description, posts,
  };
};

const loadNewPosts = (state, id) => {
  const channel = state.channels.find((el) => el.id === id);
  const channelPosts = state.posts.filter((el) => el.id === id);
  return axios.get(`https://cors-anywhere.herokuapp.com/${channel.url}`)
    .then((response) => {
      const { posts } = parse(response.data);
      return posts.reduce((acc, post) => {
        if (!channelPosts.some((e) => e.guid === post.postGuid)) {
          return [...acc, {
            id: channel.id,
            title: post.postTitle,
            link: post.postLink,
            description: post.postDescription,
            guid: post.postGuid,
          }];
        }
        return acc;
      }, []);
    })
    .catch((error) => console.log(error));
};

const app = () => {
  const state = {
    additionProcess: {
      status: 'empty',
      url: '',
      valid: true,
    },
    activeChannelId: null,
    channels: [],
    posts: [],
  };

  const { input, form, channelsContainer } = getDomElements();
  channelsContainer.addEventListener('click', (e) => {
    e.preventDefault();
    const a = e.target.closest('a');
    state.activeChannelId = a ? a.dataset.id : state.activeChannelId;
  });
  input.addEventListener('input', () => {
    state.additionProcess.url = input.value;
    const { url } = state.additionProcess;
    const { channels } = state;
    if (url === '') {
      state.additionProcess.status = 'empty';
      state.additionProcess.valid = true;
    } else {
      state.additionProcess.status = 'idle';
      state.additionProcess.valid = isURL(url) && !channels.some((e) => e.url === url);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { url } = state.additionProcess;
    state.additionProcess.status = 'loading';
    const channelURL = `https://cors-anywhere.herokuapp.com/${url}`;
    axios.get(channelURL)
      .then((response) => {
        state.additionProcess.status = 'idle';
        const {
          title, description, id, posts,
        } = parse(response.data);
        posts.forEach((post) => {
          state.posts.push({
            id,
            title: post.postTitle,
            link: post.postLink,
            description: post.postDescription,
            guid: post.postGuid,
          });
        });
        state.channels.push({
          id, title, description, url, status: 'idle',
        });
        state.additionProcess.status = 'empty';
        state.activeChannelId = id;
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
  WatchJS.watch(state, ['activeChannelId', 'channels', 'posts'], () => {
    renderFeeds(state);
  });
  $('#exampleModal').on('show.bs.modal', (event) => {
    const button = $(event.relatedTarget);
    const descr = button.data('descr');
    $('.modal-body div').html(_.unescape(descr));
  });
};

export default app;
