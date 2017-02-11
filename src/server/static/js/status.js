Vue.component('queued-anime', {
  props: ['anime'],
  computed: {
    deleteUrl: function() {
      if (this.anime) {
        return "/delete/" + this.anime.id
      } else {
        return "#";
      }
    }
  },
  template: '<li class="list-group-item"><span class="badge"><a :href="deleteUrl"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span></a></span>{{anime.filename}}</li>'
})


var vm = new Vue({
  el: "#app",
  data: {
    status: {}
  },
  computed: {
    percent: function() {
      if (this.status) {
        return Math.round(this.status.currentProgress*10)/10;
      } else {
        return 0;
      }
    }
  }
});

function fetchStatus() {
  fetch("/status")
    .then(it => it.json())
    .then(it => vm.status = it)
}
fetchStatus();
setInterval(fetchStatus, 5000)