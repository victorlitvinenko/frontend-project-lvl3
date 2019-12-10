import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';

const state = {
  addProcess: {
    status: 'idle',
    url: '',
    valid: true,
    visitedUrls: [],
  },
  feedProcess: {
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

const toggleAddItems = (alertShow, spinnerShow, inputDisabled) => {
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
      toggleAddItems(true, false, false);
      break;
    case 'loading':
      toggleAddItems(false, true, true);
      break;
    default:
      toggleAddItems(false, false, false);
  }
  input.value = url;
  addBtn.disabled = !valid || url === '' || status === 'loading';
  if (valid) {
    input.classList.remove('border', 'border-danger');
  } else {
    input.classList.add('border', 'border-danger');
  }
};

const prepareLine = (str) => {
  const li = document.createElement('li');
  li.classList.add('list-group-item');
  li.innerHTML = str;
  return li;
};

const renderFeeds = () => {
  const { channels, posts } = state.feedProcess;
  const { channelsContainer, postsContainer } = getDOMElements();
  const channelsUl = document.createElement('ul');
  channelsUl.id = 'channels';
  channelsUl.classList.add('list-group');
  channels.forEach((channel) => {
    channelsUl.append(prepareLine(`<strong>${channel.title}</strong>: ${channel.description}`));
  });
  const postsUl = document.createElement('ul');
  postsUl.id = 'posts';
  postsUl.classList.add('list-group', 'my-3');
  posts.forEach((post) => {
    postsUl.append(prepareLine(`<a target="_blank" href="${post.link}">${post.title}</a>`));
  });
  channelsContainer.replaceWith(channelsUl);
  postsContainer.replaceWith(postsUl);
};

const app = () => {
  const { input, form } = getDOMElements();
  input.addEventListener('keyup', () => {
    state.addProcess.status = 'idle';
    state.addProcess.url = input.value;
    const { url } = state.addProcess;
    if (url === '') {
      state.addProcess.valid = true;
    } else {
      state.addProcess.valid = isURL(url) && !state.addProcess.visitedUrls.includes(url);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { url } = state.addProcess;
    if (url !== '') {
      state.addProcess.status = 'loading';
      axios.get(`https://cors-anywhere.herokuapp.com/${url}`)
        .then((response) => {
          state.addProcess.status = 'idle';
          const doc = new DOMParser().parseFromString(response.data, 'text/xml');
          const title = doc.querySelector('channel title').textContent;
          const description = doc.querySelector('channel description').textContent;
          const posts = doc.querySelectorAll('channel item');
          posts.forEach((post) => {
            const postTitle = post.querySelector('title').textContent;
            const postLink = post.querySelector('link').textContent;
            state.feedProcess.posts.push({ title: postTitle, link: postLink });
          });
          state.addProcess.visitedUrls.push(url);
          state.feedProcess.channels.push({ title, description });
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
