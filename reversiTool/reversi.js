const raycaster = new THREE.Raycaster();

function board3d_viewer_constr(me){
    var renderer, camera, mouse;
    me.get_dom_el = function(k){ return renderer.domElement };
    /*
    function canvas_renderer(){
        return window.CanvasRenderingContext2D && new THREE.CanvasRenderer();
    }
    function webgl_renderer(){ try{ 
        return  window.WebGLRenderingContext &&
            document.createElement('canvas').getContext('experimental-webgl') &&
            new THREE.WebGLRenderer();
    }catch(e){} }*/


    me.init = function(scene,w,h){
        function nw(tp){ try{ return new(THREE[tp]) }catch(e){} }
        renderer = nw('WebGLRenderer') || nw('CanvasRenderer');
        if(!renderer) return 0;
        renderer.setSize(w,h);
        mouse = new THREE.Vector2();
        camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 2000);
        camera.position.x = 200;
        camera.up.x = 0;
        camera.up.y = 0;
        camera.up.z = 1;
        return 1;
    }
    me.set_size = function(w,h){
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w,h);
    };
    me.animation_frame = function(){
        camera.position.z = 600 + me.jumping.z / 2;
        camera.lookAt( me.jumping.scene.position );
    };
    me.render = function(scene){  };
    me.get_pointer = function(x,y) {
        mouse.x = x * 2 - 1;
        mouse.y = -y * 2 + 1;
        return mouse;
    }
    me.get_pointer3d = function(x,y){
        mouse.x = x * 2 - 1;
        mouse.y = - y * 2 + 1;
        var vector = new THREE.Vector3( mouse.x, mouse.y, 0.5 );
        vector.unproject(camera);
        return new THREE.Ray( camera.position, vector.sub( camera.position ).normalize() );
    }
    return me;
}

function make_fig_geometry(w,h,colors){
    var shape = new THREE.Shape();
    shape.absarc( 0, 0, w, 0, - Math.PI*2 );
    var geometry = new THREE.ExtrudeGeometry( shape, { amount:h });
    var ocolors = [];
    colors.forEach(function(v,j){ ocolors[j] = new THREE.Color(v) });
    // geometry.faces.forEach(function(face){
    //     face.color = ocolors[ face.normal.z>0.01 ?1: face.normal.z<-0.01 ?2:0 ];
    // });
    return geometry;
}

function add_rect(geometry,x0,x1,y0,y1,ucolor,dcolor){
    var l = geometry.vertices.length;
    geometry.vertices.push( new THREE.Vector3(x0,y0));
    geometry.vertices.push( new THREE.Vector3(x1,y0));
    geometry.vertices.push( new THREE.Vector3(x1,y1));
    geometry.vertices.push( new THREE.Vector3(x0,y1));
    function face(v0,v1,v2,v3,n,color){
        var normal = new THREE.Vector3(0,0,n);
        var ocolor = new THREE.Color(color);
        var oface = new THREE.Face4(l+v0, l+v1, l+v2, l+v3, normal, ocolor, 0);
        geometry.faces.push(oface);
    }
    face(0, 1, 2, 3, 1, ucolor);
    face(3, 2, 1, 0, -1, dcolor);
}

function make_sq_geom(r,ucolor,dcolor){
    // var geom = new THREE.Geometry();
    // add_rect(geom,-r,+r,-r,+r,ucolor,dcolor);
    // return geom;
    const geo = new THREE.BoxGeometry(r, r, 1);
    return geo;
}

function board3d_scene_constr(me, scene){
    const scale = 3;
    var size = 8, sq_sz = 100 * scale, ln_r = 2.5;
    var grid_depth = 10, grid_color = 0xdddddd, cell_color = 0x00cc00, over_color = 0xffff00;
    var fig_height = 15 * scale, fig_width = 40 * scale;

    me.scene = scene;
    var material = new THREE.MeshLambertMaterial({color: 0x408080});
    const focus_mat = new THREE.MeshLambertMaterial({color: 0x60ffff});
    const hover_mat = new THREE.MeshLambertMaterial({color: 0xd0ffff});
    const top_mat = new THREE.MeshLambertMaterial({color: 0xff0000});
    const bottom_mat = new THREE.MeshLambertMaterial({color: 0x0000ff});
    const board_mat = new THREE.MeshLambertMaterial({color: 0x002020});

    var fig_geometry = make_fig_geometry(fig_width,fig_height / 2,me.fig_colors);
    var grid_geometry = make_sq_geom(sq_sz/2+ln_r, grid_color, grid_color);
    var cell_geometry = make_sq_geom(sq_sz/2-ln_r, cell_color, over_color);
    const board_geometry = make_sq_geom(sq_sz * size, cell_color, cell_color);
    const board_mesh = new THREE.Mesh(board_geometry, board_mat);
    scene.add(board_mesh);
    board_mesh.position.z -= fig_height;
    
    var fig_list = [], cell_mesh_list = [];
    for(var ypos=0;ypos<size;ypos++){
        for(var xpos=0;xpos<size;xpos++){
            const fig_top_mesh = new THREE.Mesh(fig_geometry, top_mat);
            const fig_bottom_mesh = new THREE.Mesh(fig_geometry, bottom_mat);
            var fig_mesh = new THREE.Group();
            fig_mesh.add(fig_top_mesh);
            fig_mesh.add(fig_bottom_mesh);
            fig_top_mesh.position.z += fig_height / 4;
            fig_bottom_mesh.position.z -= fig_height / 4;
            var cell_mesh = new THREE.Mesh(cell_geometry, material);
            cell_mesh.defaultMat = material;
            cell_mesh.focusMat = focus_mat;
            cell_mesh.hoverMat = hover_mat;
            var grid_mesh = new THREE.Mesh(grid_geometry, material);
            grid_mesh.position.x = cell_mesh.position.x = fig_mesh.position.x =
                (xpos-size/2+0.5)*sq_sz;
            grid_mesh.position.y = cell_mesh.position.y = fig_mesh.position.y =
                (ypos-size/2+0.5)*sq_sz;
            grid_mesh.position.z = -grid_depth;
            scene.add(fig_mesh);
            scene.add(cell_mesh);
            // scene.add(grid_mesh);
            fig_list.push({mesh:fig_mesh});
            cell_mesh.board_pos = cell_mesh_list.length;
            cell_mesh_list.push(cell_mesh);
        }
    }

    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.position.z = 1;
    directionalLight.position.normalize();
    scene.add( directionalLight );

    var states =
        [{ z:1000, rot:Math.PI/2 }, { z:0, rot:0}, { z:fig_height, rot:Math.PI}];

//////////////////////////////////////

    var animation_q = [], last_moment=0;
    me.animation_frame = function(){
        if(!animation_q.length) return;
        while(!animation_q[0]() && animation_q.length>1) animation_q.shift();
    };
    function animation_q_push(period,f){
        var b = Math.max(last_moment,Date.now());
        last_moment = b + period;
        animation_q.push(function(){ return f((Date.now()-b)/period) });
    }


    var over_board_pos = -1, state, last_states;
    function animate_state(ps,ns,phase,jmps,cam_jump,can_move){
        var jz = Math.abs(Math.sin(phase*Math.PI));
        me.jumping.z = cam_jump * jz;
        fig_list.forEach(function(fig,j){
            var p = ps[j];
            var n = ns[j];
            fig.mesh.position.z = p.z + (n.z-p.z)*phase + (jmps?jmps[j]:0)*jz;
            fig.mesh.rotation.y = p.rot + (n.rot-p.rot)*phase;

            var mv = fig.can_move = can_move && can_move[j];
            // fig can be played onto the board, it is a valid move
            if (fig.mesh.position.z < 950) {
                fig.mesh.visible = true;
            } else {
                fig.mesh.visible = false
            }
            // cell_mesh_list[j].rotation.y = mv ? Math.PI:0;
            // cell_mesh_list[j].position.z = mv && over_board_pos===j
            //     ? -1-grid_depth : 1-grid_depth;
            if (mv) {
                if (over_board_pos === j) {
                    cell_mesh_list[j].material = cell_mesh_list[j].hoverMat;
                } else {
                    cell_mesh_list[j].material = cell_mesh_list[j].focusMat;
                }
            } else {
                cell_mesh_list[j].material = cell_mesh_list[j].defaultMat;
            }
        });
    }
    me.state2dom = function(s){ state2q(s); state = s; };
    //function once(){ var was=0; function(f){ if(!(was++)) f() } }
    function periodical_sound(times,period,id){
        // var until = 0, snd = document.getElementById(id);
        // return function(f){
        //     var now = Date.now()
        //     if(times && until < now){
        //         times--; until = now + period; snd.cloneNode(true).play();
        //     }
        // }
    }
    function state2q(gs){
        if(state && state.serialized()===gs.serialized()) return;
        var ps = last_states||[], n1s = [], n2s = [], can_move = [];
        var jmps = [], is_putting = 0, is_changing = 0;
        last_states = n2s;
        gs.for_each_cell(function(j,bc){
            can_move[j] = gs.can_move(j);
            if(!ps[j]) ps[j] = states[0];
            n1s[j] = ps[j] === states[0] ? states[bc] : ps[j];
            if(ps[j] === states[0] && n1s[j] !== states[0]) is_putting = 1;
            if(ps[j] !== states[bc]) is_changing = 1;
            n2s[j] = states[bc];
            jmps[j] = n1s[j] === n2s[j] ? 0:100;
        });
        if(is_putting) animation_q_push(1500,function(phase){
            animate_state(ps,n1s,Math.min(1,phase),0,0,0);
            return phase < 1;
        });
        var slam = is_putting && periodical_sound(1,0,'snd_slam');
        animation_q_push( is_changing?1500:200, function(phase){
            if(slam) slam();
            var cm = phase > 1 && me.state4local(gs) && can_move;
            var cam_jump = is_putting ? 100:0;
            animate_state(n1s,n2s,Math.min(1,phase),jmps,cam_jump, cm);
            return phase < 1;
        });
        if(gs.get_active_player_num()) return; //game not finished
        var win_jmps = [], pl_jmp = [];
        pl_jmp[1] = gs.get_player_diff(1)<0 ? 0:100;
        pl_jmp[2] = gs.get_player_diff(2)<0 ? 0:100;
        gs.for_each_cell(function(j,bc){ win_jmps[j] = pl_jmp[bc] });
        var fanfare =
            me.state4local(gs) && periodical_sound(4,5000,'snd_fanfare');
        animation_q_push(1500,function(phase){
            if(fanfare) fanfare();
            animate_state(n2s,n2s,phase,win_jmps,0,0);
            return 0;
        });
    }

//http://localhost:8080/#00002222120e0000ffffddddedf1ffff0ml
//http://localhost:8080/#40a0fc40200000003f1f03bfdfffffff2ml
//http://localhost:8080/#00001c0020000000ffffe3ffdfffffff0ml
//http://localhost:8080/#3f1f03bfdfffffff40a0fc40200000001ml
//////////////////////////////////////
    me.ray2pos = function(ray){
        //if(!can_move) return -1;
        raycaster.set(camera.position, ray.direction);
        var intersects = raycaster.intersectObjects( cell_mesh_list );
        if(!intersects.length) return -1;
        var pos = intersects[0].object.board_pos;
        if(!fig_list[pos].can_move) return -1;
        return pos;
    }
    me.pointer2pos = function(pointer){
        raycaster.setFromCamera(pointer, window.realCamera);
        var intersects = raycaster.intersectObjects( cell_mesh_list );
        if(!intersects.length) return -1;
        var pos = intersects[0].object.board_pos;
        if(!fig_list[pos].can_move) return -1;
        return pos;
    }
    me.target_by_ray = function(ray){
        over_board_pos = me.ray2pos(ray);
    };
    me.target_by_pointer = function(pointer){
        over_board_pos = me.pointer2pos(pointer);
    };
    return me;
}
/******************************************************************************/
var game_states = {};
function game_state(state){
    if(game_states[state]) return game_states[state];
    var me = game_states[state] = {};
    var parts = state.match(
        /^([\da-fA-F]{32})([012])([\dA-Fa-f]*)([g-z][\dA-Fa-f]*)([g-z][\dA-Fa-f]*)$/
    ) || ['','00000008100000000000001008000000','1','','l','l'];
    var brd = parts[1], active = parseInt(parts[2]);
    var chan = parts[3], players = [parts[4],parts[5]];
    var passive = 3-active;
    var board = [], moves;
    board_unpack();

    me.serialized = function(){ return state };
    me.get_brd = function(){ return brd };
    me.get_brd4active = function(){
        return active===1 ? brd:
            active===2 ? brd.substring(16,32) + brd.substring(0,16) : ''
    };
    me.replace_players = function(num,chan,p1,p2){
        return game_state(board_pack(board,active) + chan +
            ((num==1?p1:p2)||players[0])+
            ((num==1?p2:p1)||players[1])
        );
    };
    me.with_players = function(num,f){
        return num==1 ? f(chan,players[0],players[1]) : f(chan,players[1],players[0])
    };
    me.get_active_player_num = function(){ return active };
    me.unpack_move = function(mb){
        var v0 = parse(mb,0), v1 = parse(mb,1);
        for(var i=0;i<32;i++){
            if(1 & (v0 >> i)) return me.move(i+32);
            if(1 & (v1 >> i)) return me.move(i);
        }
    }
    function parse(brd,s){ return parseInt(brd.substring(s*8,s*8+8),16) }
    function board_unpack(){
        function merge(v0,v1,spos){
            for(var i=0;i<32;i++)
                board[spos+i] = (1 & (v0 >> i)) | ((1 & (v1 >> i))<<1);
        }
        merge(parse(brd,1),parse(brd,3),0);
        merge(parse(brd,0),parse(brd,2),32);
    }
    function board_pack(board,active){
        var res = '';
        function plp(pl){
            for(var i=15;i>=0;i--) res+=(
                (board[i*4+0]==pl?1:0)|
                (board[i*4+1]==pl?2:0)|
                (board[i*4+2]==pl?4:0)|
                (board[i*4+3]==pl?8:0)
            ).toString(16);
        }
        plp(1); plp(2);
        return res + active.toString();
    }
    function find_moves(board,active){
        var moves = [];
        function chk(spos,ppos,pos){
            var d = ppos%8-pos%8;
            if(pos<0 || pos>=64 || d*d>1 || !board[pos]) return 0;
            if(board[pos]===active) return 1;
            if(!chk(spos,pos,pos+pos-ppos)) return 0;
            if(!moves[spos]) moves[spos] = {count:0};
            moves[spos][pos] = moves[spos][spos] = 1;
            moves[spos].count++;
            return 1;
        }
        me.for_each_cell(function(p,bc){ if(!board[p]){ // !!! board[p]!=bc
            chk(p,p,p-9); chk(p,p,p-8); chk(p,p,p-7); chk(p,p,p-1);
            chk(p,p,p+9); chk(p,p,p+8); chk(p,p,p+7); chk(p,p,p+1);
        }});
        return moves;
    }
    me.for_each_cell = function(f){ for(var p = 0; p<64; p++) f(p, board[p]) };
    me.can_move = function(pos){
        if(!moves) moves = find_moves(board,active);
        return moves[pos] ? moves[pos].count:0;
    };
    me.move = function(pos){
        if(!moves) moves = find_moves(board,active);
        var mr = moves[pos];
        if(!mr) return;
        var nboard = [];
        me.for_each_cell(function(j,bc){ nboard[j] = mr[j] ? active : bc });
        var nactive = find_moves(nboard,passive).length ? passive :
            find_moves(nboard,active).length ? active : 0;
        return game_state(board_pack(nboard,nactive)+chan+players[0]+players[1]);
    }
    me.get_player_score = function(num){
        var res = 0;
        me.for_each_cell(function(j,bc){ if(bc===num)res++ });
        return res;
    };
    me.get_player_diff = function(num){
        var res = 0;
        me.for_each_cell(function(j,bc){ if(bc===num)res++; else if(bc) res-- });
        return res;
    };
    return me;
}

/******************************************************************************/

function player_constr(num){
    var me = {}, type = {};
    var tp_abbr2nm = {'n':'none','l':'local','p':'peer','s':'server','m':'dummy'};
    for(var abbr in tp_abbr2nm) type[tp_abbr2nm[abbr]] = {abbr:abbr};

    var dom_els = {};
    function cached_div(h,k){ return h[k]||(h[k]=document.createElement('div'))}
    me.get_dom_el = function(k){ return cached_div(dom_els,k) };
    function state2ctp(state){
        return state.with_players(num,function(chan,pm,po){
            return type[tp_abbr2nm[pm.substring(0,1)]];
        });
    }
    function state2dom(ctp,state){
        var wns = !state.get_active_player_num() && state.get_player_diff(num)>0;
        if(wns && ctp===type.local) me.set_state4local(state);

        me.get_dom_el('score').innerHTML = ctp.get_name() + ( ctp===type.none ?
            '' : ': '+ state.get_player_score(num) + (wns ? ' WINS':'') );

        var main_el = me.get_dom_el('main');
        main_el.innerHTML = '';
        function player_selector(tp){
            if(ctp!==tp && ctp!==type.none) return;
            var btel = me.get_dom_el('player_selector_'+tp.abbr);
            if(tp.disabled && tp.disabled())
                me.btn( main_el, btel, '#AAAAAA', tp.get_name(), function(){});
            else me.btn( main_el, btel, me.bgcolor, tp.get_name(), function(){
                if(tp.select){ tp.select(); return }
                var state = me.get_state();
                state.with_players(num,function(chan,pm,po){
                    me.set_state(state.replace_players(num,chan,tp.abbr,po))
                })
            });
        }
        player_selector(type.local);
        player_selector(type.dummy);
        player_selector(type.peer);
        player_selector(type.server);
        if(ctp.state2hint) ctp.state2hint(state);
    };
    me.sync_state = function(){
        var state = me.get_state();
        var ctp = state2ctp(state);
        state2dom(ctp,state);
        if(ctp.sync_state) ctp.sync_state();
    };
    me.find_best_move = function(){
        var state = me.get_state();
        var ctp = state2ctp(state);
        if(ctp.find_best_move) ctp.find_best_move();
    }
    function http_req(meth,url,frecv){
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open(meth, url, true);
        xmlhttp.onreadystatechange = function(){
            if(xmlhttp.readyState === 4) if(xmlhttp.status === 200)
                frecv(xmlhttp.responseText);
        };
        xmlhttp.send(null);
    }

    type.none.get_name   = function(){ return 'select player' };
    type.local.get_name  = function(){ return 'local human' };
    type.peer.get_name   = function(){ return 'remote human' };
    type.server.get_name = function(){ return 'remote robot' };
    type.dummy.get_name  = function(){ return 'local robot' };

    type.peer.disabled = function(){ return !window.goog };
    type.server.disabled = function(){ return !window.goog };

    type.peer.state2hint = function(state){
        // var hint_el = me.get_dom_el('hint');
        // hint_el.className = 'hint';
        // var href = location.protocol + '//' + location.host +
        //     location.pathname + '#' + peer_state(state);
        // hint_el.innerHTML = 'Send link <a href="'+href+'">'+href+'</a> to peer ';
        // me.get_dom_el('main').appendChild(hint_el);
    };
    function peer_state(state){
        return state.with_players(num,function(chan,pm,po){
            return state.replace_players( num,
                pm.substring(1), type.local.abbr, pm.substring(0,1)+chan
            ).serialized();
        });
    }
    /*
    var socket, plid2socket;
    function need_socket(plid){
        if(socket && plid2socket===plid) return socket;
        socket = new EasyWebSocket("ws://reversi.rewlad/"+plid);
        socket.onmessage = function(ev){ me.set_state(game_state(ev.data)) };
        plid2socket = plid;
        return socket;
    }
    type.peer.sync_state = function(){
        var state = me.get_state();
        need_socket(state.get_player(num)).send(peer_state(state));
    };*/
    type.peer.select = function(repl){
        http_req('POST','/peer?create=uuid',function(txt){
            var p = txt.split('-');
            me.get_state().with_players(num, function(chan,pm,po){
                var nchan = chan || p[0];
                var npm = type.peer.abbr + p[4];
                me.set_state(me.get_state().replace_players(num,nchan,npm,po));
            });
        });
    };
    var socket, sock_key;
    function onmessage(msg){
        var m = msg.data.match(/\w+/);
        if(m) me.set_state(game_state(m[0]));
    }
    function voidact(){}
    type.peer.sync_state = function(){
        var state = me.get_state();
        state.with_players(num, function(chan,pm,po){
            var url = '/peer?peer='+pm.substring(1)+'&state='+peer_state(state);
            var create = socket && sock_key===chan ? '':'&create='+chan;
            http_req('POST', url+create, function(token){
                if(!create) return;
                sock_key = chan;
                var channel = new goog.appengine.Channel(token);

                socket = channel.open({ onmessage:onmessage, onopen:voidact });//onclose/onerror
            });
        });
    };

    type.local.find_best_move = function(){
        me.set_state4local(me.get_state());
    };


    function move_delayed_redo(reg){
        var state = me.get_state();
        var nstate = reg.moves_found && reg.moves_found[state.serialized()];
        if(nstate) setTimeout(function(){ move_do(state,nstate) },6000);
        return nstate;
    }
    function move_found(reg,state,nstate){
        if(!reg.moves_found) reg.moves_found = {};
        reg.moves_found[state.serialized()] = nstate;
        move_do(state,nstate)
    }
    function move_do(state,nstate){
        if(state===me.get_state()) me.set_state(nstate)
    }

    type.dummy.find_best_move = function(){
        if(move_delayed_redo(type.dummy)) return;
        var sinc=0, spos=-1;
        var state = me.get_state();
        state.for_each_cell(function(pos,bc){
            var inc = state.can_move(pos);
            if(sinc<inc){sinc=inc; spos=pos}
        });
        if(spos>=0) move_found(type.dummy, state, state.move(spos))
    };

    type.server.find_best_move = function(){
        if(move_delayed_redo(type.server)) return;
        var state = me.get_state();
        var url = '/shifter/'+state.get_brd4active();
        http_req('GET', url, function(txt){
            move_found(type.server, state, state.unpack_move(txt));
        })
    };

    return me;
};

const load_reversi = function(scene){
    function hash_get_state(){ return game_state(location.hash.substring(1)) }
    function hash_set_state(gs){ if(gs) location.hash = '#' + gs.serialized() }

    function color_pair(bg){
        var m = bg.match(/^#(\w\w)(\w\w)(\w\w)$/);
        var rgb = m.map(function(v,j){ return j ? parseInt(v) : '' });
        return 0.213 * rgb[0] + 0.715 * rgb[1] + 0.072 * rgb[2] < 128 ?
            '#FFFFFF' : '#000000';
    }

    var fig_colors = ['#000000','#ff0000','#0000ff'];
    var hfig_colors = fig_colors.map(function(c){
        return parseInt(c.substring(1),16)
    });
    var players = [ player_constr(1), player_constr(2) ];

    var board3d_scene = board3d_scene_constr({fig_colors:hfig_colors}, scene);
    var board3d_viewer = board3d_viewer_constr({});
    if(!board3d_viewer.init(
        board3d_scene.scene,
        window.innerWidth,
        window.innerHeight
    )){
        txt_dialog("txt_render_fail")();
        return;
    }
    var jumping = board3d_viewer.jumping = board3d_scene.jumping = {};
    jumping.scene = board3d_scene.scene;
    board3d_scene.state4local = function(gs){ return state4local===gs };

    function render() {
        requestAnimationFrame(render);
        board3d_scene.animation_frame();
        board3d_viewer.animation_frame();
        board3d_viewer.render(board3d_scene.scene);
    }

    var state4local;
    function hash_changed(){
        players.forEach(function(player,j){ player.sync_state() });
        var state = hash_get_state()
        board3d_scene.state2dom(state);
        var num = state.get_active_player_num();
        if(num) players[num-1].find_best_move();
    }

    var p = document.body;
    p.appendChild(board3d_viewer.get_dom_el('main'));

    var top_el = document.getElementById('ctl_area');

    function btn(ptel,btel,bgc,html,act){
        // if(!bgc) bgc = '#00AA00';
        // btel.className = 'btn';
        // btel.style.backgroundColor = bgc;
        // btel.style.color = color_pair(bgc);
        // btel.innerHTML = html;
        // btel.onclick = function(ev){ act() };
        // ptel.appendChild(btel);
    }
    function div(){ return document.createElement('div') }
    var dlg_hides = [];
    function txt_dialog(id){
        // var el = document.getElementById(id);
        // var bts_el = div();
        // bts_el.style.textAlign = 'right';
        // el.appendChild(bts_el);
        // function hide(){ el.style.display = 'none' }
        // dlg_hides.push(hide);
        // btn(bts_el,div(),0,'close',hide);
        // return function(){
        //     dlg_hides.forEach(function(f){ f() });
        //     el.style.display = 'block'
        // };
    }

    btn(top_el, div(), 0, 'reset game', function(){
        var num = 1;
        hash_get_state().with_players(num, function(chan,pm,po){
            hash_set_state( game_state('').replace_players(num,chan,pm,po) );
        });
    });
    btn(top_el, div(), 0,'reset with players',function(){
        hash_set_state(game_state(''))
    });
    btn(top_el,div(),0,'history &amp; rules',txt_dialog('txt_rules'));
    btn(top_el,div(),0,'release features',txt_dialog('txt_notes'));
    var dlg_players = txt_dialog('txt_players');
    var players_bts_el = document.getElementById('players_bts');

    players.forEach(function(pl,j){
        var num = j+1;
        btn(top_el, pl.get_dom_el('score'), fig_colors[num], '', dlg_players);
        // players_bts_el.appendChild(pl.get_dom_el('main'));
        pl.btn = btn;
        pl.get_state = hash_get_state;
        pl.set_state = hash_set_state;
        pl.set_state4local = function(v){ state4local = v };
        pl.bgcolor = fig_colors[num];
    });

    var inp = document.createElement('input');
    inp.style.display = 'none';
    inp.value =
        window.localStorage && localStorage.getItem('reversi-background-image') ||
        'sky.svg';
    inp.onchange = function(ev){bgchange()};
    function bgchange(){
        if(window.localStorage)
            localStorage.setItem('reversi-background-image',inp.value);
        p.style.background = "url("+inp.value+") no-repeat";
        p.style.backgroundSize = "100% 100%";
    };
    bgchange();
    p.appendChild(inp);


    window.onresize = function(){
        board3d_viewer.set_size(window.innerWidth, window.innerHeight);
    };
    function pointer(ev) {
        return board3d_viewer.get_pointer(
            ev.clientX / window.innerWidth, ev.clientY / window.innerHeight
        );
    }
    function ray(ev) {
        return board3d_viewer.get_pointer3d(
            ev.clientX / window.innerWidth, ev.clientY / window.innerHeight
        );
    }
    document.addEventListener('pointermove', ev => {
        // board3d_scene.target_by_ray(ray(ev));
        board3d_scene.target_by_pointer(pointer(ev));
    });
    // TODO: this is where the move is made
    // board3d_viewer.get_dom_el('main').onclick = function(ev){
    document.addEventListener('pointerdown', ev => {
        var pos = board3d_scene.pointer2pos(pointer(ev));
        if(pos<0) return;
        hash_set_state(hash_get_state().move(pos));
    });
    window.onhashchange = hash_changed;

    hash_changed();
    render();
};
/*
select player, find_best_move, move => set hash
reset => set hash
sync from peer * => set hash or hist go

paste
hist back

avoid robot turn
avoid sync break hist
*/
