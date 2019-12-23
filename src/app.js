import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';
import _ from 'lodash';
import $ from 'jquery';

const elements = {
  input: document.querySelector('#input'),
  form: document.querySelector('#form'),
  addBtn: document.querySelector('#add'),
  spinner: document.querySelector('#spinner'),
  alert: document.querySelector('#alert'),
  channelsContainer: document.querySelector('#channels'),
  postsContainer: document.querySelector('#posts'),
};

const toggleAdditionItems = (config) => {
  const {
    visibleAlert, visibleSpinner, inputDisabled, addBtnDisabled,
  } = config;
  const {
    input, spinner, alert, addBtn,
  } = elements;
  if (visibleAlert) {
    alert.classList.remove('d-none');
  } else {
    alert.classList.add('d-none');
  }
  if (visibleSpinner) {
    spinner.classList.remove('d-none');
  } else {
    spinner.classList.add('d-none');
  }
  input.disabled = inputDisabled;
  addBtn.disabled = addBtnDisabled;
};

const renderAdditionSection = (state) => {
  const { input } = elements;
  const { url, valid, status } = state.additionProcess;
  input.value = url;
  switch (status) {
    case 'error':
      toggleAdditionItems({
        visibleAlert: true, visibleSpinner: false, inputDisabled: false, addBtnDisabled: true,
      });
      break;
    case 'loading':
      toggleAdditionItems({
        visibleAlert: false, visibleSpinner: true, inputDisabled: true, addBtnDisabled: true,
      });
      break;
    case 'idle':
      toggleAdditionItems({
        visibleAlert: false, visibleSpinner: false, inputDisabled: false, addBtnDisabled: !valid,
      });
      break;
    case 'empty':
      toggleAdditionItems({
        visibleAlert: false, visibleSpinner: false, inputDisabled: false, addBtnDisabled: true,
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
  const { channelsContainer, postsContainer } = elements;
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
            data-toggle="modal" data-target="#exampleModal" data-description="${_.escape(post.description)}">?</button>
        </div>
      </div></li>`;
    postsContainer.insertAdjacentHTML('beforeend', str);
  });
};

const parse = (data, id = _.uniqueId()) => {
  const doc = new DOMParser().parseFromString(data, 'text/xml');
  const channelTitle = doc.querySelector('channel title').textContent;
  const channelDescription = doc.querySelector('channel description').textContent;
  const postsElements = doc.querySelectorAll('item');
  const posts = [...postsElements].map((post) => {
    const title = post.querySelector('title').textContent;
    const link = post.querySelector('link').textContent;
    const description = post.querySelector('description').textContent;
    const guid = post.querySelector('guid').textContent;
    return {
      id, title, link, description, guid,
    };
  });
  return {
    id, title: channelTitle, description: channelDescription, posts,
  };
};

const loadNewPosts = (state, id) => {
  const channel = state.channels.find((el) => el.id === id);
  const channelPosts = state.posts.filter((el) => el.id === id);
  return axios.get(`https://cors-anywhere.herokuapp.com/${channel.url}`)
    .then((response) => {
      const { posts } = parse(response.data, channel.id);
      return _.difference(posts, channelPosts);
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

  const { input, form, channelsContainer } = elements;
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
      state.additionProcess.valid = isURL(url) && !channels.some((el) => el.url === url);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { url } = state.additionProcess;
    state.additionProcess.status = 'loading';
    const channelURL = `https://cors-anywhere.herokuapp.com/${url}`;
    axios.get(channelURL)
      .then((response) => {
        const {
          title, description, id, posts,
        } = parse(response.data);
        state.posts = [...state.posts, ...posts];
        state.channels.push({
          id, title, description, url, status: 'idle',
        });
        state.additionProcess.status = 'empty';
        state.activeChannelId = id;
        setInterval(() => {
          const channel = state.channels.find((el) => el.id === id);
          if (channel.status === 'loading') return;
          channel.status = 'loading';
          loadNewPosts(state, id)
            .then((newPosts) => {
              state.posts = [...newPosts, ...state.posts];
            })
            .catch((error) => {
              console.log(error);
            })
            .finally(() => {
              channel.status = 'idle';
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
    const description = button.data('description');
    $('.modal-body div').html(_.unescape(description));
  });
};

export default app;
