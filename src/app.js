import isURL from 'validator/lib/isURL';
import axios from 'axios';
import WatchJS from 'melanke-watchjs';

const renderAddField = (state) => {
  const input = document.querySelector('#input');
  const addBtn = document.querySelector('#add');
  const spinner = document.querySelector('#spinner');
  const alert = document.querySelector('#alert');
  const { url, valid, status } = state.addProcess;
  switch (status) {
    case 'error':
      alert.classList.remove('d-none');
      spinner.classList.add('d-none');
      input.disabled = false;
      break;
    case 'loading':
      spinner.classList.remove('d-none');
      alert.classList.add('d-none');
      input.disabled = true;
      break;
    default:
      spinner.classList.add('d-none');
      alert.classList.add('d-none');
      input.disabled = false;
  }
  input.value = url;
  addBtn.disabled = !valid || url === '';
  if (valid) {
    input.classList.remove('border', 'border-danger');
  } else {
    input.classList.add('border', 'border-danger');
  }
};

const renderFeeds = (state) => {
  const { channels, posts } = state.feedProcess;
  const channelsContainer = document.querySelector('#channels');
  const postsContainer = document.querySelector('#posts');
  const channelsUl = document.createElement('ul');
  channelsUl.id = 'channels';
  channelsUl.classList.add('list-group');
  channels.forEach((channel) => {
    const li = document.createElement('li');
    li.classList.add('list-group-item');
    li.innerHTML = `<strong>${channel.title}</strong>: ${channel.description}`;
    channelsUl.append(li);
  });
  const postsUl = document.createElement('ul');
  postsUl.id = 'posts';
  postsUl.classList.add('list-group', 'mt-3');
  posts.forEach((post) => {
    const li = document.createElement('li');
    li.classList.add('list-group-item');
    li.innerHTML = `<a target="_blank" href="${post.link}">${post.title}</a>`;
    postsUl.append(li);
  });
  channelsContainer.replaceWith(channelsUl);
  postsContainer.replaceWith(postsUl);
};

const app = () => {
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

  const input = document.querySelector('#input');
  const form = document.querySelector('#form');
  input.addEventListener('change', () => {
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
    renderAddField(state);
  });
  WatchJS.watch(state, 'feedProcess', () => {
    renderFeeds(state);
  });
};

export default app;
